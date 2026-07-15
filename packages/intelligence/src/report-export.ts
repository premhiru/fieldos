import type {
  DailySummary,
  IntelligenceBullet,
  IntelligenceRisk,
  MorningBrief,
  PendingDecision,
  WeeklyReport
} from "./types.js";

export function morningBriefToMarkdown(report: MorningBrief): string {
  return [
    `# ${report.title}`,
    "",
    `Generated: ${report.generatedAt.toISOString()}`,
    "",
    section("Brief", report.bullets)
  ].join("\n");
}

export function dailySummaryToMarkdown(report: DailySummary, generatedAt: Date): string {
  return [
    `# ${report.title}`,
    "",
    `Generated: ${generatedAt.toISOString()}`,
    "",
    section("Work Completed", report.workCompleted),
    section("Evidence Received", report.evidenceReceived),
    section("Inspections Requested", report.inspectionsRequested),
    section("Approvals Received", report.approvalsReceived),
    section("Issues Raised", report.issuesRaised),
    section("Action Items Created", report.actionItemsCreated),
    section("Timeline Highlights", report.timelineHighlights)
  ].join("\n");
}

export function weeklyReportToMarkdown(report: WeeklyReport): string {
  return [
    `# ${report.title}`,
    "",
    `Project: ${report.project.code} ${report.project.name}`,
    `Generated: ${report.generatedAt.toISOString()}`,
    "",
    section("Executive Summary", report.executiveSummary),
    section("Progress This Week", report.progressThisWeek),
    section("Completed Work", report.completedWork),
    riskSection(report.openRisks),
    decisionSection(report.outstandingDecisions),
    section("Upcoming Work", report.upcomingWork),
    section("Recent Evidence", report.recentEvidence),
    "## Appendix",
    section("Recent Photos", report.appendix.recentPhotos),
    section("Recent Documents", report.appendix.recentDocuments),
    section("Recent Action Items", report.appendix.recentActionItems)
  ].join("\n");
}

export function weeklyReportToPdfBuffer(report: WeeklyReport): Buffer {
  return reportMarkdownToPdfBuffer(weeklyReportToMarkdown(report));
}

export function riskSummaryToMarkdown(input: {
  generatedAt: Date;
  risks: IntelligenceRisk[];
  title: string;
}): string {
  return [
    `# ${input.title}`,
    "",
    `Generated: ${input.generatedAt.toISOString()}`,
    "",
    riskSection(input.risks)
  ].join("\n");
}

export function pendingDecisionsToMarkdown(input: {
  decisions: PendingDecision[];
  generatedAt: Date;
  title: string;
}): string {
  return [
    `# ${input.title}`,
    "",
    `Generated: ${input.generatedAt.toISOString()}`,
    "",
    decisionSection(input.decisions)
  ].join("\n");
}

export function reportMarkdownToPdfBuffer(markdown: string): Buffer {
  const lines = markdown
    .split("\n")
    .map((line) => line.replace(/^#{1,3}\s*/, ""))
    .filter((line) => line.trim().length > 0);

  return createSimplePdf(lines);
}

function section(title: string, bullets: IntelligenceBullet[]): string {
  return [
    `## ${title}`,
    "",
    ...(bullets.length > 0 ? bullets.map((item) => `- ${item.text}`) : ["- None recorded."]),
    ""
  ].join("\n");
}

function riskSection(risks: IntelligenceRisk[]): string {
  return [
    "## Open Risks",
    "",
    ...(risks.length > 0
      ? risks.map((risk) => `- ${risk.title}: ${risk.explanation} Mitigation: ${risk.mitigation}`)
      : ["- None recorded."]),
    ""
  ].join("\n");
}

function decisionSection(decisions: PendingDecision[]): string {
  return [
    "## Outstanding Decisions",
    "",
    ...(decisions.length > 0
      ? decisions.map((decision) => `- ${decision.title}: ${decision.description}`)
      : ["- None recorded."]),
    ""
  ].join("\n");
}

function createSimplePdf(lines: string[]): Buffer {
  const escapedLines = lines.slice(0, 55).map(escapePdfText);
  const content = [
    "BT",
    "/F1 16 Tf",
    "50 780 Td",
    ...escapedLines.flatMap((line, index) => [
      index === 0 ? "" : "0 -14 Td",
      `(${line.slice(0, 105)}) Tj`
    ]),
    "ET"
  ]
    .filter(Boolean)
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf);
}

function escapePdfText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}
