import type { PrismaClient, UnifiedEvidenceContext } from "@fieldos/db";
import {
  buildUnifiedEvidenceContext,
  formatEvidenceSummary,
  queueAIClassificationJob,
  queueSearchIndexJob
} from "@fieldos/db";
import { createLogger } from "@fieldos/shared";

import { buildClassificationDecisionContext } from "./classification-context.js";
import { AIConfigurationError, MessageClassifier } from "./message-classifier.js";
import { MessageClassifierV2 } from "./message-classifier-v2.js";
import { messageClassificationPromptVersionV2 } from "./prompts/message-classification.v2.js";
import { isAIProviderRateLimitError } from "./provider-errors.js";
import type {
  ClassifyMessageResult,
  ClassifyMessageV2Input,
  ClassifyMessageV2Result
} from "./types.js";

interface ProjectCandidate {
  code: string;
  id: string;
  name: string;
}

export interface AIClassificationProcessorOptions {
  batchSize?: number;
  classifier?: Pick<MessageClassifier, "classifyMessage">;
  classifierV2?: Pick<MessageClassifierV2, "classifyMessage" | "model">;
  decisionEngineMode?: "legacy" | "shadow" | "v2";
}

export class AIClassificationProcessor {
  private readonly batchSize: number;
  private readonly classifier: Pick<MessageClassifier, "classifyMessage">;
  private readonly classifierV2: Pick<MessageClassifierV2, "classifyMessage" | "model">;
  private readonly decisionEngineMode: "legacy" | "shadow" | "v2";
  private readonly logger = createLogger("ai-classification");

  constructor(
    private readonly prisma: PrismaClient,
    options: AIClassificationProcessorOptions = {}
  ) {
    this.batchSize = options.batchSize ?? 5;
    this.classifier = options.classifier ?? new MessageClassifier();
    this.classifierV2 = options.classifierV2 ?? new MessageClassifierV2();
    this.decisionEngineMode = options.decisionEngineMode ?? "legacy";
  }

  async enqueueMessage(messageId: string): Promise<void> {
    const context = await this.getMessageContext(messageId);

    if (!context) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const classification = await tx.aIMessageClassification.upsert({
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

      await tx.message.update({
        data: {
          processingStatus: "AI_PENDING"
        },
        where: {
          id: messageId
        }
      });

      await queueAIClassificationJob(tx, {
        organizationId: classification.organizationId,
        projectId: classification.projectId,
        sourceId: classification.id
      });
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
      where: {
        id: classificationId
      }
    });

    if (!classification) {
      return;
    }

    const input = await buildUnifiedEvidenceContext(this.prisma, classification.messageId);

    if (!input) {
      await this.markFailed(classification.id, "Message evidence context could not be built.");
      return;
    }

    try {
      const projects = await this.prisma.project.findMany({
        select: {
          code: true,
          id: true,
          name: true
        },
        where: {
          organizationId: input.organizationId,
          status: {
            not: "ARCHIVED"
          }
        }
      });
      if (this.decisionEngineMode !== "v2") {
        const result = await this.classifier.classifyMessage(input);
        await this.saveResult(classification.id, {
          currentProjectId: input.project?.id ?? null,
          evidenceContext: input,
          messageBody: input.messageText,
          organizationId: input.organizationId,
          projects,
          result
        });
      }

      if (this.decisionEngineMode !== "legacy") {
        try {
          const decisionContext = await buildClassificationDecisionContext(this.prisma, input);
          const resultV2 = await this.classifierV2.classifyMessage(decisionContext);
          await this.saveV2Decision(classification.id, decisionContext, resultV2);

          if (this.decisionEngineMode === "v2") {
            await this.saveResult(classification.id, {
              currentProjectId: input.project?.id ?? null,
              evidenceContext: input,
              messageBody: input.messageText,
              organizationId: input.organizationId,
              projects,
              result: compatibilityResult(resultV2)
            });
          }
        } catch (error) {
          if (this.decisionEngineMode !== "shadow") {
            throw error;
          }
          this.logger.warn(
            { classificationId: classification.id, error },
            "AI v2 shadow classification failed without affecting legacy result"
          );
        }
      }
    } catch (error: unknown) {
      if (isAIProviderRateLimitError(error)) {
        this.logger.warn(
          {
            classificationId: classification.id,
            retryAfterMs: error.retryAfterMs,
            status: error.status
          },
          "AI classification rate limited; keeping classification pending"
        );
        throw error;
      }

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

  private async saveV2Decision(
    classificationId: string,
    input: ClassifyMessageV2Input,
    result: ClassifyMessageV2Result
  ): Promise<void> {
    const mode = this.decisionEngineMode === "v2" ? "V2" : "SHADOW";

    await this.prisma.$transaction(async (tx) => {
      await tx.aIClassificationDecision.upsert({
        create: {
          abstentionReason: result.abstentionReason,
          classificationId,
          completionClaim: result.completionClaim,
          confidence: result.confidence,
          factualClaims: result.factualClaims,
          inspectionReadiness: result.inspectionReadiness,
          ambiguity: result.ambiguity,
          location: result.location,
          locations: result.locations,
          mode,
          model: this.classifierV2.model,
          operationalImpact: result.operationalImpact,
          organizationId: input.organizationId,
          primaryCategory: result.primaryCategory,
          processedAt: new Date(),
          projectId: input.project?.id ?? null,
          promptVersion: messageClassificationPromptVersionV2,
          provider: "kimi-primary-openrouter-fallback",
          recommendationEligible: result.recommendationEligible,
          recommendationEligibilityReason: result.recommendationEligibilityReason,
          referencedDates: result.referencedDates,
          relevance: result.relevance,
          responseExpectation: result.responseExpectation,
          schemaVersion: "2.2",
          secondarySignals: result.secondarySignals,
          summary: result.summary,
          uncertainty: result.uncertainty,
          userFacingReason: result.userFacingReason
        },
        update: {
          abstentionReason: result.abstentionReason,
          completionClaim: result.completionClaim,
          confidence: result.confidence,
          factualClaims: result.factualClaims,
          inspectionReadiness: result.inspectionReadiness,
          ambiguity: result.ambiguity,
          location: result.location,
          locations: result.locations,
          mode,
          model: this.classifierV2.model,
          operationalImpact: result.operationalImpact,
          primaryCategory: result.primaryCategory,
          processedAt: new Date(),
          promptVersion: messageClassificationPromptVersionV2,
          provider: "kimi-primary-openrouter-fallback",
          recommendationEligible: result.recommendationEligible,
          recommendationEligibilityReason: result.recommendationEligibilityReason,
          referencedDates: result.referencedDates,
          relevance: result.relevance,
          responseExpectation: result.responseExpectation,
          schemaVersion: "2.2",
          secondarySignals: result.secondarySignals,
          summary: result.summary,
          uncertainty: result.uncertainty,
          userFacingReason: result.userFacingReason
        },
        where: { classificationId }
      });

      const expectation = result.responseExpectation;
      if (input.project && expectation.status === "RESOLVED" && expectation.requestedItem) {
        await tx.outstandingExpectation.updateMany({
          data: {
            resolutionReason: `Resolved by later message ${input.messageId}.`,
            resolvedByMessageId: input.messageId,
            status: "RESOLVED"
          },
          where: {
            conversationId: input.conversation.id,
            projectId: input.project.id,
            requestedItem: { equals: expectation.requestedItem, mode: "insensitive" },
            status: "OPEN"
          }
        });
      }
      if (
        input.project &&
        expectation.status === "OPEN" &&
        expectation.type !== "NONE" &&
        expectation.requestedItem
      ) {
        await tx.outstandingExpectation.upsert({
          create: {
            confidence: result.confidence,
            conversationId: input.conversation.id,
            dueAt: expectation.dueAt ? new Date(expectation.dueAt) : null,
            evidence: {
              classificationId,
              messageId: input.messageId,
              support: expectation.evidence
            },
            expectedResponder: expectation.expectedResponder,
            organizationId: input.organizationId,
            projectId: input.project.id,
            requestedItem: expectation.requestedItem,
            sourceMessageId: input.messageId,
            type: expectation.type
          },
          update: {
            confidence: result.confidence,
            dueAt: expectation.dueAt ? new Date(expectation.dueAt) : null,
            evidence: {
              classificationId,
              messageId: input.messageId,
              support: expectation.evidence
            },
            expectedResponder: expectation.expectedResponder,
            status: "OPEN"
          },
          where: {
            sourceMessageId_type_requestedItem: {
              requestedItem: expectation.requestedItem,
              sourceMessageId: input.messageId,
              type: expectation.type
            }
          }
        });
      }
    });

    this.logger.info(
      {
        classificationId,
        mode,
        operationalImpact: result.operationalImpact,
        projectId: input.project?.id ?? null,
        recommendationEligible: result.recommendationEligible,
        relevance: result.relevance
      },
      "AI classification v2 decision persisted"
    );
  }

  private async saveResult(
    classificationId: string,
    input: {
      organizationId: string;
      currentProjectId: string | null;
      evidenceContext: UnifiedEvidenceContext;
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

      await tx.message.update({
        data: {
          processingStatus: "AI_COMPLETE"
        },
        where: {
          id: classification.messageId
        }
      });

      const existingMessageEvent = await tx.event.findFirst({
        where: {
          sourceId: classification.messageId,
          sourceType: "MESSAGE"
        }
      });
      const messageEvent = existingMessageEvent
        ? await tx.event.update({
            data: {
              description: buildEvidenceEventDescription(input.evidenceContext, input.result),
              eventType: "MESSAGE_EVIDENCE_RECEIVED",
              occurredAt: input.evidenceContext.timestamp,
              organizationId: input.organizationId,
              projectId: input.currentProjectId,
              title: buildEvidenceEventTitle(input.evidenceContext)
            },
            where: {
              id: existingMessageEvent.id
            }
          })
        : await tx.event.create({
            data: {
              description: buildEvidenceEventDescription(input.evidenceContext, input.result),
              eventType: "MESSAGE_EVIDENCE_RECEIVED",
              occurredAt: input.evidenceContext.timestamp,
              organizationId: input.organizationId,
              projectId: input.currentProjectId,
              sourceId: classification.messageId,
              sourceType: "MESSAGE",
              title: buildEvidenceEventTitle(input.evidenceContext)
            }
          });

      await queueSearchIndexJob(tx, {
        organizationId: messageEvent.organizationId,
        projectId: messageEvent.projectId,
        sourceId: messageEvent.id,
        sourceType: "TIMELINE_EVENT"
      });

      await queueSearchIndexJob(tx, {
        organizationId: input.organizationId,
        projectId: input.currentProjectId,
        sourceId: classification.messageId,
        sourceType: "MESSAGE"
      });

      await queueSearchIndexJob(tx, {
        organizationId: classification.organizationId,
        projectId: classification.projectId,
        sourceId: classification.id,
        sourceType: "AI_CLASSIFICATION"
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

        const event = await tx.event.create({
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

        await queueSearchIndexJob(tx, {
          organizationId: actionItem.organizationId,
          projectId: actionItem.projectId,
          sourceId: actionItem.id,
          sourceType: "ACTION_ITEM"
        });

        await queueSearchIndexJob(tx, {
          organizationId: event.organizationId,
          projectId: event.projectId,
          sourceId: event.id,
          sourceType: "TIMELINE_EVENT"
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

        const event = await tx.event.create({
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

        await queueSearchIndexJob(tx, {
          organizationId: actionItem.organizationId,
          projectId: actionItem.projectId ?? actionItem.suggestedProjectId,
          sourceId: actionItem.id,
          sourceType: "ACTION_ITEM"
        });

        await queueSearchIndexJob(tx, {
          organizationId: event.organizationId,
          projectId: event.projectId,
          sourceId: event.id,
          sourceType: "TIMELINE_EVENT"
        });
      }
    });
  }

  private async markFailed(classificationId: string, errorMessage: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const classification = await tx.aIMessageClassification.update({
        data: {
          errorMessage,
          status: "FAILED"
        },
        where: {
          id: classificationId
        }
      });

      await tx.message.update({
        data: {
          processingStatus: "FAILED"
        },
        where: {
          id: classification.messageId
        }
      });
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

function compatibilityResult(result: ClassifyMessageV2Result): ClassifyMessageResult {
  return {
    actionRequired: false,
    category: result.primaryCategory,
    confidence: result.confidence,
    location: result.location,
    reasoningSummary: result.userFacingReason,
    summary: result.summary
  };
}

function buildEvidenceEventTitle(context: UnifiedEvidenceContext): string {
  const summary = formatEvidenceSummary(context.evidenceSummary);
  return context.evidenceSummary.attachmentCount > 0
    ? `${context.sender.displayName}: ${summary}`
    : `${context.sender.displayName}: Message update`;
}

function buildEvidenceEventDescription(
  context: UnifiedEvidenceContext,
  result: ClassifyMessageResult
): string {
  return [
    context.messageText ?? "",
    context.voiceTranscript ? `Voice transcript: ${context.voiceTranscript}` : "",
    context.evidenceSummary.attachmentCount > 0
      ? `Evidence Summary: ${formatEvidenceSummary(context.evidenceSummary)}`
      : "",
    `AI Summary: ${result.summary}`
  ]
    .filter(Boolean)
    .join("\n");
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
