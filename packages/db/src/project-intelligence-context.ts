import type { ProjectIntelligenceContext } from "@fieldos/intelligence";
import type { Prisma, PrismaClient } from "@prisma/client";

export async function buildProjectIntelligenceContext(
  prisma: PrismaClient | Prisma.TransactionClient,
  projectId: string,
  generatedAt = new Date()
): Promise<ProjectIntelligenceContext | null> {
  const project = await prisma.project.findUnique({
    select: {
      code: true,
      id: true,
      name: true,
      status: true
    },
    where: {
      id: projectId
    }
  });

  if (!project) {
    return null;
  }

  const [events, actionItems, classifications, photoAnalyses, attachments, milestones] =
    await Promise.all([
      prisma.event.findMany({
        orderBy: {
          occurredAt: "desc"
        },
        take: 80,
        where: {
          projectId
        }
      }),
      prisma.actionItem.findMany({
        orderBy: {
          createdAt: "desc"
        },
        take: 80,
        where: {
          OR: [{ projectId }, { suggestedProjectId: projectId }]
        }
      }),
      prisma.aIMessageClassification.findMany({
        orderBy: {
          createdAt: "desc"
        },
        take: 80,
        where: {
          projectId
        }
      }),
      prisma.photoAnalysis.findMany({
        orderBy: {
          createdAt: "desc"
        },
        take: 60,
        where: {
          projectId
        }
      }),
      prisma.attachment.findMany({
        orderBy: {
          createdAt: "desc"
        },
        take: 80,
        where: {
          message: {
            conversation: {
              projectId
            }
          }
        }
      }),
      prisma.milestone.findMany({
        orderBy: [{ plannedEndDate: "asc" }, { plannedStartDate: "asc" }],
        take: 30,
        where: {
          projectId
        }
      })
    ]);

  return {
    actionItems: actionItems.map((item) => ({
      createdAt: item.createdAt,
      description: item.description,
      id: item.id,
      messageId: item.messageId,
      priority: item.priority,
      status: item.status,
      title: item.title,
      type: item.type,
      updatedAt: item.updatedAt
    })),
    classifications: classifications.map((classification) => ({
      actionRequired: classification.actionRequired,
      category: classification.category,
      confidence: classification.confidence,
      createdAt: classification.createdAt,
      id: classification.id,
      location: classification.location,
      messageId: classification.messageId,
      reasoningSummary: classification.reasoningSummary,
      status: classification.status,
      summary: classification.summary,
      updatedAt: classification.updatedAt
    })),
    evidence: attachments.map((attachment) => ({
      createdAt: attachment.createdAt,
      filename: attachment.filename,
      id: attachment.id,
      messageId: attachment.messageId,
      mimeType: attachment.mimeType,
      transcript: attachment.transcript,
      transcriptionStatus: attachment.transcriptionStatus
    })),
    events: events.map((event) => ({
      description: event.description,
      eventType: event.eventType,
      id: event.id,
      occurredAt: event.occurredAt,
      sourceId: event.sourceId,
      sourceType: event.sourceType,
      title: event.title
    })),
    generatedAt,
    milestones: milestones.map((milestone) => ({
      id: milestone.id,
      plannedEndDate: milestone.plannedEndDate,
      plannedStartDate: milestone.plannedStartDate,
      status: milestone.status,
      title: milestone.title
    })),
    photoAnalyses: photoAnalyses.map((analysis) => ({
      confidence: analysis.confidence,
      createdAt: analysis.createdAt,
      detectedObjects: jsonStringArray(analysis.detectedObjects),
      evidenceId: analysis.evidenceId,
      id: analysis.id,
      possibleIssues: jsonStringArray(analysis.possibleIssues),
      summary: analysis.summary,
      tags: jsonStringArray(analysis.tags)
    })),
    project: {
      code: project.code,
      id: project.id,
      name: project.name,
      status: project.status
    }
  };
}

function jsonStringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}
