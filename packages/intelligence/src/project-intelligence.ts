import type {
  DailySummary,
  IntelligenceBullet,
  IntelligenceConfidence,
  IntelligenceRisk,
  MorningBrief,
  PendingDecision,
  ProjectIntelligenceContext,
  WeeklyReport
} from "./types.js";

const dayMs = 86_400_000;

export class ProjectIntelligenceService {
  generateMorningBrief(context: ProjectIntelligenceContext): MorningBrief {
    const yesterdayStart = startOfDay(new Date(context.generatedAt.getTime() - dayMs));
    const todayStart = startOfDay(context.generatedAt);
    const yesterdayEvents = context.events.filter(
      (event) => event.occurredAt >= yesterdayStart && event.occurredAt < todayStart
    );
    const openActionItems = pendingActionItems(context).slice(0, 3);
    const upcomingMilestones = context.milestones
      .filter((milestone) => milestone.status !== "COMPLETED" && milestone.dueDate >= todayStart)
      .sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime())
      .slice(0, 2);
    const risks = this.generateRiskSummary(context).slice(0, 2);
    const bullets: IntelligenceBullet[] = [
      ...yesterdayEvents
        .slice(0, 2)
        .map((event) =>
          bullet(`${event.title}: ${event.description ?? event.eventType}`, [
            source("TIMELINE_EVENT", event.id, event.title)
          ])
        ),
      ...openActionItems.map((item) =>
        bullet(`Priority: ${item.title}`, [source("ACTION_ITEM", item.id, item.title)])
      ),
      ...upcomingMilestones.map((milestone) =>
        bullet(`Upcoming milestone: ${milestone.title} due ${formatDate(milestone.dueDate)}`, [
          source("MILESTONE", milestone.id, milestone.title)
        ])
      ),
      ...risks.map((risk) => bullet(`Risk to watch: ${risk.title}`, risk.sources))
    ].slice(0, 8);

    return {
      bullets:
        bullets.length > 0
          ? bullets
          : [bullet("No project activity was recorded for the current brief window.", [])],
      generatedAt: context.generatedAt,
      title: `${context.project.name} Morning Brief`
    };
  }

  generateDailySummary(context: ProjectIntelligenceContext): DailySummary {
    const todayStart = startOfDay(context.generatedAt);
    const todayEvents = context.events.filter((event) => event.occurredAt >= todayStart);
    const todayClassifications = context.classifications.filter(
      (classification) => classification.createdAt >= todayStart
    );
    const todayEvidence = context.evidence.filter((item) => item.createdAt >= todayStart);
    const todayActionItems = context.actionItems.filter((item) => item.createdAt >= todayStart);

    return {
      actionItemsCreated: todayActionItems
        .slice(0, 6)
        .map((item) => bullet(item.title, [source("ACTION_ITEM", item.id, item.title)])),
      approvalsReceived: todayClassifications
        .filter((classification) => classification.category === "CLIENT_APPROVAL")
        .slice(0, 5)
        .map(classificationBullet),
      evidenceReceived: todayEvidence
        .slice(0, 8)
        .map((item) =>
          bullet(`${item.filename} (${formatMime(item.mimeType)})`, [
            source("EVIDENCE", item.id, item.filename)
          ])
        ),
      inspectionsRequested: todayClassifications
        .filter((classification) => classification.category === "INSPECTION_REQUEST")
        .slice(0, 5)
        .map(classificationBullet),
      issuesRaised: todayClassifications
        .filter((classification) =>
          ["DEFECT", "DELAY", "MATERIAL_ISSUE", "MANPOWER_ISSUE", "SAFETY_ISSUE"].includes(
            classification.category ?? ""
          )
        )
        .slice(0, 6)
        .map(classificationBullet),
      timelineHighlights: todayEvents
        .slice(0, 8)
        .map((event) =>
          bullet(`${event.title}: ${event.description ?? event.eventType}`, [
            source("TIMELINE_EVENT", event.id, event.title)
          ])
        ),
      title: `${context.project.name} Daily Summary`,
      workCompleted: todayClassifications
        .filter((classification) => classification.category === "PROGRESS_UPDATE")
        .slice(0, 6)
        .map(classificationBullet)
    };
  }

  generateWeeklyReport(context: ProjectIntelligenceContext): WeeklyReport {
    const weekStart = new Date(context.generatedAt.getTime() - 7 * dayMs);
    const weeklyEvents = context.events.filter((event) => event.occurredAt >= weekStart);
    const weeklyEvidence = context.evidence.filter((item) => item.createdAt >= weekStart);
    const weeklyClassifications = context.classifications.filter(
      (classification) => classification.createdAt >= weekStart
    );
    const weeklyActionItems = context.actionItems.filter((item) => item.createdAt >= weekStart);

    return {
      appendix: {
        recentActionItems: weeklyActionItems
          .slice(0, 10)
          .map((item) =>
            bullet(`${item.priority}: ${item.title}`, [source("ACTION_ITEM", item.id, item.title)])
          ),
        recentDocuments: weeklyEvidence
          .filter((item) => isDocument(item.mimeType))
          .slice(0, 8)
          .map((item) => bullet(item.filename, [source("EVIDENCE", item.id, item.filename)])),
        recentPhotos: context.photoAnalyses
          .filter((analysis) => analysis.createdAt >= weekStart)
          .slice(0, 8)
          .map((analysis) =>
            bullet(analysis.summary, [source("PHOTO_ANALYSIS", analysis.id, "Photo analysis")])
          )
      },
      completedWork: weeklyClassifications
        .filter((classification) => classification.category === "PROGRESS_UPDATE")
        .slice(0, 8)
        .map(classificationBullet),
      executiveSummary: [
        bullet(`${weeklyEvents.length} timeline events were recorded this week.`, []),
        bullet(`${weeklyEvidence.length} evidence items were received.`, []),
        bullet(`${pendingActionItems(context).length} Action Items remain open.`, [])
      ],
      generatedAt: context.generatedAt,
      openRisks: this.generateRiskSummary(context),
      outstandingDecisions: this.generatePendingDecisions(context),
      progressThisWeek: weeklyEvents
        .slice(0, 8)
        .map((event) =>
          bullet(`${event.title}: ${event.description ?? event.eventType}`, [
            source("TIMELINE_EVENT", event.id, event.title)
          ])
        ),
      project: context.project,
      recentEvidence: weeklyEvidence
        .slice(0, 10)
        .map((item) => bullet(item.filename, [source("EVIDENCE", item.id, item.filename)])),
      title: `${context.project.name} Weekly Progress Report`,
      upcomingWork: context.milestones
        .filter((milestone) => milestone.status !== "COMPLETED")
        .sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime())
        .slice(0, 6)
        .map((milestone) =>
          bullet(`${milestone.title} due ${formatDate(milestone.dueDate)}`, [
            source("MILESTONE", milestone.id, milestone.title)
          ])
        )
    };
  }

  generateRiskSummary(context: ProjectIntelligenceContext): IntelligenceRisk[] {
    const classificationRisks = context.classifications
      .filter((classification) =>
        ["DEFECT", "DELAY", "MATERIAL_ISSUE", "MANPOWER_ISSUE", "SAFETY_ISSUE"].includes(
          classification.category ?? ""
        )
      )
      .map((classification) => ({
        confidence: confidenceLabel(classification.confidence),
        explanation:
          classification.reasoningSummary ??
          classification.summary ??
          "Risk was identified from project message classification.",
        mitigation: mitigationForCategory(classification.category),
        sources: [
          source("AI_CLASSIFICATION", classification.id, classification.category ?? "Risk")
        ],
        title: classification.summary ?? classification.category ?? "Project risk"
      }));
    const photoRisks = context.photoAnalyses
      .filter((analysis) => analysis.possibleIssues.length > 0)
      .map((analysis) => ({
        confidence: confidenceLabel(analysis.confidence),
        explanation: analysis.possibleIssues.join(" "),
        mitigation:
          "Review the source photo and assign a responsible person if the issue is confirmed.",
        sources: [source("PHOTO_ANALYSIS", analysis.id, "Photo analysis")],
        title: analysis.summary
      }));

    return [...classificationRisks, ...photoRisks]
      .sort((left, right) => confidenceScore(right.confidence) - confidenceScore(left.confidence))
      .slice(0, 5);
  }

  generatePendingDecisions(context: ProjectIntelligenceContext): PendingDecision[] {
    return pendingActionItems(context)
      .filter(
        (item) => ["HIGH", "URGENT"].includes(item.priority) || item.type === "PROJECT_SUGGESTION"
      )
      .slice(0, 10)
      .map((item) => ({
        category:
          item.type === "PROJECT_SUGGESTION"
            ? "APPROVAL_REQUIRED"
            : item.title.toLowerCase().includes("inspection")
              ? "INSPECTION_REVIEW"
              : item.title.toLowerCase().includes("client")
                ? "CLIENT_FOLLOW_UP"
                : item.title.toLowerCase().includes("supplier")
                  ? "SUPPLIER_FOLLOW_UP"
                  : "HIGH_PRIORITY_ACTION_ITEM",
        description: item.description ?? item.title,
        priority: item.priority,
        sources: [source("ACTION_ITEM", item.id, item.title)],
        title: item.title
      }));
  }
}

function pendingActionItems(context: ProjectIntelligenceContext) {
  return context.actionItems
    .filter((item) => ["ACCEPTED", "PENDING"].includes(item.status))
    .sort((left, right) => priorityScore(right.priority) - priorityScore(left.priority));
}

function classificationBullet(
  classification: ProjectIntelligenceContext["classifications"][number]
) {
  return bullet(classification.summary ?? classification.category ?? "AI classification", [
    source("AI_CLASSIFICATION", classification.id, classification.category ?? "AI classification")
  ]);
}

function bullet(text: string, sources: IntelligenceBullet["sources"]): IntelligenceBullet {
  return { sources, text };
}

function source(type: IntelligenceBullet["sources"][number]["type"], id: string, label: string) {
  return { id, label, type };
}

function confidenceLabel(confidence: number | null): IntelligenceConfidence {
  if (confidence === null) {
    return "MEDIUM";
  }

  if (confidence >= 0.75) {
    return "HIGH";
  }

  if (confidence >= 0.45) {
    return "MEDIUM";
  }

  return "LOW";
}

function confidenceScore(confidence: IntelligenceConfidence): number {
  return confidence === "HIGH" ? 3 : confidence === "MEDIUM" ? 2 : 1;
}

function priorityScore(priority: string): number {
  return priority === "URGENT" ? 4 : priority === "HIGH" ? 3 : priority === "MEDIUM" ? 2 : 1;
}

function mitigationForCategory(category: string | null): string {
  switch (category) {
    case "DELAY":
      return "Confirm the blocker, owner, and recovery date with the site team.";
    case "DEFECT":
      return "Review the source evidence, assign rectification owner, and confirm closure evidence.";
    case "SAFETY_ISSUE":
      return "Escalate for immediate safety review before work continues in the affected area.";
    case "MATERIAL_ISSUE":
      return "Confirm material status with supplier and update the project plan if delivery changes.";
    case "MANPOWER_ISSUE":
      return "Confirm staffing plan and adjust near-term work sequencing if needed.";
    default:
      return "Review supporting evidence and assign a follow-up owner if confirmed.";
  }
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatMime(mimeType: string): string {
  return mimeType.split("/").at(1)?.toUpperCase() ?? mimeType;
}

function isDocument(mimeType: string): boolean {
  return mimeType.includes("pdf") || mimeType.includes("document") || mimeType.includes("text");
}
