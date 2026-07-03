import type { PrismaClient } from "@fieldos/db";
import { createLogger } from "@fieldos/shared";

import { AIConfigurationError, MessageClassifier } from "./message-classifier.js";
import type { ClassifyMessageInput, ClassifyMessageResult } from "./types.js";

interface ProjectCandidate {
  code: string;
  id: string;
  name: string;
}

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

    if (!context) {
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
    const input: ClassifyMessageInput = {
      conversationTitle: message.conversation.title,
      messageBody: message.body,
      messageId: message.id,
      messageType: message.type,
      occurredAt: message.occurredAt,
      organizationId: message.conversation.organizationId,
      projectId: message.conversation.projectId,
      senderName: message.senderParticipant.displayName
    };

    try {
      const result = await this.classifier.classifyMessage(input);
      const projects = await this.prisma.project.findMany({
        select: {
          code: true,
          id: true,
          name: true
        },
        where: {
          organizationId: message.conversation.organizationId,
          status: {
            not: "ARCHIVED"
          }
        }
      });
      await this.saveResult(classification.id, {
        currentProjectId: message.conversation.projectId,
        messageBody: message.body,
        organizationId: message.conversation.organizationId,
        projects,
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
      currentProjectId: string | null;
      messageBody: string | null;
      projects: ProjectCandidate[];
      result: ClassifyMessageResult;
    }
  ): Promise<void> {
    const projectSuggestion = findProjectSuggestion({
      currentProjectId: input.currentProjectId,
      messageBody: input.messageBody,
      projects: input.projects
    });

    await this.prisma.$transaction(async (tx) => {
      const classification = await tx.aIMessageClassification.update({
        data: {
          actionRequired: input.result.actionRequired,
          category: input.result.category,
          confidence: input.result.confidence,
          errorMessage: null,
          location: input.result.location,
          projectId: input.currentProjectId,
          reasoningSummary: input.result.reasoningSummary,
          status: "COMPLETED",
          summary: input.result.summary
        },
        where: {
          id: classificationId
        }
      });

      await tx.actionItem.deleteMany({
        where: {
          classificationId,
          status: "PENDING"
        }
      });

      if (input.result.actionRequired) {
        const actionItem = await tx.actionItem.create({
          data: {
            classificationId,
            confidence: input.result.confidence,
            description: input.result.reasoningSummary,
            messageId: classification.messageId,
            organizationId: input.organizationId,
            projectId: input.currentProjectId,
            status: "PENDING",
            title: buildFollowUpTitle(input.result),
            type: "FOLLOW_UP"
          }
        });

        await tx.event.create({
          data: {
            description: actionItem.description,
            eventType: "ACTION_ITEM_CREATED",
            occurredAt: actionItem.createdAt,
            organizationId: actionItem.organizationId,
            projectId: actionItem.projectId,
            sourceId: actionItem.id,
            sourceType: "ACTION_ITEM",
            title: actionItem.title
          }
        });
      }

      if (projectSuggestion) {
        const actionItem = await tx.actionItem.create({
          data: {
            classificationId,
            confidence: projectSuggestion.confidence,
            description: projectSuggestion.description,
            messageId: classification.messageId,
            organizationId: input.organizationId,
            projectId: input.currentProjectId,
            status: "PENDING",
            suggestedProjectId: projectSuggestion.project.id,
            title: `This message may belong to Project ${projectSuggestion.project.name}.`,
            type: "PROJECT_SUGGESTION"
          }
        });

        await tx.event.create({
          data: {
            description: actionItem.description,
            eventType: "ACTION_ITEM_CREATED",
            occurredAt: actionItem.createdAt,
            organizationId: actionItem.organizationId,
            projectId: actionItem.projectId ?? actionItem.suggestedProjectId,
            sourceId: actionItem.id,
            sourceType: "ACTION_ITEM",
            title: actionItem.title
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

function buildFollowUpTitle(result: ClassifyMessageResult): string {
  const summary = result.summary.trim();

  if (summary.length <= 120) {
    return summary;
  }

  return `${summary.slice(0, 117).trimEnd()}...`;
}

function findProjectSuggestion(input: {
  currentProjectId: string | null;
  messageBody: string | null;
  projects: ProjectCandidate[];
}): { confidence: number; description: string; project: ProjectCandidate } | null {
  const body = input.messageBody?.toLowerCase() ?? "";

  if (!body) {
    return null;
  }

  for (const project of input.projects) {
    if (project.id === input.currentProjectId) {
      continue;
    }

    const codeMatch = project.code && body.includes(project.code.toLowerCase());
    const nameMatch = project.name && body.includes(project.name.toLowerCase());

    if (codeMatch || nameMatch) {
      return {
        confidence: codeMatch && nameMatch ? 0.95 : 0.85,
        description: `The message references ${project.code} / ${project.name}. Review before changing project assignment.`,
        project
      };
    }
  }

  return null;
}
