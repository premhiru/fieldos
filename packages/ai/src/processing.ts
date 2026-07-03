import type { Prisma, PrismaClient } from "@fieldos/db";
import { createLogger } from "@fieldos/shared";

import { AIConfigurationError, MessageClassifier } from "./message-classifier.js";
import { messageClassificationPromptVersion } from "./prompts/message-classification.v1.js";
import type { ClassifyMessageInput, ClassifyMessageResult } from "./types.js";

export interface AIClassificationProcessorOptions {
  batchSize?: number;
  classifier?: Pick<MessageClassifier, "classifyMessage">;
}

export class AIClassificationProcessor {
  private readonly batchSize: number;
  private readonly classifier: Pick<MessageClassifier, "classifyMessage">;
  private readonly logger = createLogger("ai-classification");

  constructor(
    private readonly prisma: PrismaClient,
    options: AIClassificationProcessorOptions = {}
  ) {
    this.batchSize = options.batchSize ?? 5;
    this.classifier = options.classifier ?? new MessageClassifier();
  }

  async enqueueMessage(messageId: string): Promise<void> {
    const context = await this.getMessageContext(messageId);

    if (!context || !context.conversation.projectId) {
      return;
    }

    await this.prisma.aIMessageClassification.upsert({
      create: {
        messageId,
        organizationId: context.conversation.organizationId,
        projectId: context.conversation.projectId,
        status: "PENDING"
      },
      update: {
        errorMessage: null,
        status: "PENDING"
      },
      where: {
        messageId
      }
    });
  }

  async processPending(): Promise<number> {
    const classifications = await this.prisma.aIMessageClassification.findMany({
      orderBy: {
        createdAt: "asc"
      },
      take: this.batchSize,
      where: {
        status: "PENDING"
      }
    });

    let processed = 0;

    for (const classification of classifications) {
      await this.processClassification(classification.id);
      processed += 1;
    }

    return processed;
  }

  async processClassification(classificationId: string): Promise<void> {
    const classification = await this.prisma.aIMessageClassification.findUnique({
      include: {
        message: {
          include: {
            conversation: true,
            senderParticipant: true
          }
        }
      },
      where: {
        id: classificationId
      }
    });

    if (!classification) {
      return;
    }

    const message = classification.message;
    const projectId = message.conversation.projectId;

    if (!projectId) {
      await this.markFailed(classification.id, "Message is not assigned to a project.");
      return;
    }

    const input: ClassifyMessageInput = {
      conversationTitle: message.conversation.title,
      messageBody: message.body,
      messageId: message.id,
      messageType: message.type,
      occurredAt: message.occurredAt,
      organizationId: message.conversation.organizationId,
      projectId,
      senderName: message.senderParticipant.displayName
    };

    try {
      const result = await this.classifier.classifyMessage(input);
      await this.saveResult(classification.id, {
        organizationId: message.conversation.organizationId,
        projectId,
        result
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof AIConfigurationError
          ? "AI not configured."
          : error instanceof Error
            ? error.message
            : "AI classification failed.";

      this.logger.warn({ classificationId: classification.id, error }, "AI classification failed");
      await this.markFailed(classification.id, errorMessage);
    }
  }

  private async saveResult(
    classificationId: string,
    input: {
      organizationId: string;
      projectId: string;
      result: ClassifyMessageResult;
    }
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const classification = await tx.aIMessageClassification.update({
        data: {
          category: input.result.category,
          confidence: input.result.confidence,
          errorMessage: null,
          location: input.result.location,
          priority: input.result.priority,
          projectId: input.projectId,
          rawModelOutput: {
            ...input.result,
            promptVersion: messageClassificationPromptVersion
          } satisfies Prisma.InputJsonObject,
          reasoningSummary: input.result.reasoningSummary,
          shouldCreateTask: input.result.shouldCreateTask,
          status: "COMPLETED",
          suggestedTaskDescription: input.result.suggestedTaskDescription,
          suggestedTaskTitle: input.result.suggestedTaskTitle,
          summary: input.result.summary
        },
        where: {
          id: classificationId
        }
      });

      await tx.suggestedTask.deleteMany({
        where: {
          classificationId,
          status: "PENDING"
        }
      });

      if (
        input.result.shouldCreateTask &&
        input.result.suggestedTaskTitle &&
        classification.projectId
      ) {
        await tx.suggestedTask.create({
          data: {
            classificationId,
            description: input.result.suggestedTaskDescription,
            messageId: classification.messageId,
            organizationId: input.organizationId,
            priority: input.result.priority,
            projectId: classification.projectId,
            status: "PENDING",
            title: input.result.suggestedTaskTitle
          }
        });
      }
    });
  }

  private async markFailed(classificationId: string, errorMessage: string): Promise<void> {
    await this.prisma.aIMessageClassification.update({
      data: {
        errorMessage,
        status: "FAILED"
      },
      where: {
        id: classificationId
      }
    });
  }

  private async getMessageContext(messageId: string) {
    return this.prisma.message.findUnique({
      include: {
        conversation: true
      },
      where: {
        id: messageId
      }
    });
  }
}
