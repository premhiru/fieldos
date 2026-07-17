"use client";

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@fieldos/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { AppShell } from "../../../../components/app-shell";
import { AuthGuard } from "../../../../components/auth-guard";
import { EvidenceViewer } from "../../../../components/evidence-viewer";
import {
  api,
  type DailySummary,
  type IntelligenceBullet,
  type IntelligenceRisk,
  type PendingDecision,
  type PhotoAnalysis,
  type WeeklyReport
} from "../../../../lib/api";

export default function ProjectIntelligencePage() {
  return (
    <AuthGuard>
      <AppShell>
        <ProjectIntelligenceContent />
      </AppShell>
    </AuthGuard>
  );
}

function ProjectIntelligenceContent() {
  const params = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [selectedEvidenceId, setSelectedEvidenceId] = React.useState<string | null>(null);
  const intelligenceQuery = useQuery({
    queryFn: () => api.getProjectIntelligence(params.projectId),
    queryKey: ["project-intelligence", params.projectId],
    retry: false
  });
  const photoAnalysisQuery = useQuery({
    queryFn: () => api.listProjectPhotoAnalysis(params.projectId, { limit: 12 }),
    queryKey: ["project-intelligence-photo-analysis", params.projectId],
    retry: false
  });
  const generateReportMutation = useMutation({
    mutationFn: () => api.generateProjectReport(params.projectId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["project-intelligence", params.projectId]
      });
    }
  });
  const intelligence = intelligenceQuery.data?.intelligence;
  const latestReport = intelligenceQuery.data?.latestReport;
  const photoAnalyses = photoAnalysisQuery.data?.analyses ?? [];

  if (intelligenceQuery.isLoading) {
    return <p className="text-sm text-slate-600">Loading project intelligence...</p>;
  }

  if (intelligenceQuery.isError || !intelligence) {
    return <p className="text-sm text-red-600">Unable to load project intelligence.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-start md:justify-between">
        <div>
          <Link
            className="text-sm font-medium text-slate-600 hover:text-slate-950"
            href={`/projects/${params.projectId}`}
          >
            Back to project
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            {intelligence.weeklyReport.project.name}
          </h1>
          <p className="text-sm text-slate-600">Project Intelligence</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={generateReportMutation.isPending}
            onClick={() => generateReportMutation.mutate()}
          >
            Generate Report
          </Button>
          <Button variant="secondary" onClick={() => downloadMarkdown(params.projectId)}>
            Markdown
          </Button>
          <Button variant="secondary" onClick={() => downloadPdf(params.projectId)}>
            PDF
          </Button>
        </div>
      </div>

      {latestReport ? (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-6 text-sm text-slate-700 md:flex-row md:items-center md:justify-between">
            <div>
              Cached report: <span className="font-medium">{latestReport.status}</span>
              {latestReport.generatedAt
                ? ` at ${new Date(latestReport.generatedAt).toLocaleString()}`
                : ""}
              {latestReport.errorMessage ? ` (${latestReport.errorMessage})` : ""}
            </div>
            {latestReport.pdfUrl ? (
              <a className="font-medium text-slate-950" href={latestReport.pdfUrl}>
                Open cached PDF
              </a>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <BulletCard
            title={intelligence.morningBrief.title}
            items={intelligence.morningBrief.bullets}
          />
          <DailySummaryCard items={intelligence.dailySummary} />
          <WeeklyReportCard report={intelligence.weeklyReport} />
        </div>
        <div className="space-y-6">
          <RiskCard risks={intelligence.riskSummary} />
          <PendingDecisionCard decisions={intelligence.pendingDecisions} />
          <EvidenceGallery analyses={photoAnalyses} onOpenEvidence={setSelectedEvidenceId} />
        </div>
      </div>

      <EvidenceViewer evidenceId={selectedEvidenceId} onClose={() => setSelectedEvidenceId(null)} />
    </div>
  );
}

function BulletCard({ items, title }: Readonly<{ items: IntelligenceBullet[]; title: string }>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <BulletList items={items} />
      </CardContent>
    </Card>
  );
}

function DailySummaryCard({ items }: Readonly<{ items: DailySummary }>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{items.title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <MiniSection items={items.workCompleted} title="Work Completed" />
        <MiniSection items={items.evidenceReceived} title="Evidence Received" />
        <MiniSection items={items.inspectionsRequested} title="Inspections Requested" />
        <MiniSection items={items.approvalsReceived} title="Approvals Received" />
        <MiniSection items={items.issuesRaised} title="Issues Raised" />
        <MiniSection items={items.actionItemsCreated} title="Action Items Created" />
      </CardContent>
    </Card>
  );
}

function WeeklyReportCard({ report }: Readonly<{ report: WeeklyReport }>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{report.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <MiniSection items={report.executiveSummary} title="Executive Summary" />
        <MiniSection items={report.progressThisWeek} title="Progress This Week" />
        <MiniSection items={report.completedWork} title="Completed Work" />
        <MiniSection items={report.upcomingWork} title="Upcoming Work" />
        <MiniSection items={report.recentEvidence} title="Recent Evidence" />
      </CardContent>
    </Card>
  );
}

function RiskCard({ risks }: Readonly<{ risks: IntelligenceRisk[] }>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {risks.length > 0 ? (
          risks.map((risk) => (
            <div
              key={`${risk.title}-${risk.explanation}`}
              className="rounded-md border border-slate-200 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-950">{risk.title}</div>
                <Badge variant="muted">{confidenceLabel(risk.confidence)}</Badge>
              </div>
              <p className="mt-2 text-sm text-slate-600">{risk.explanation}</p>
              <p className="mt-2 text-xs text-slate-500">{risk.mitigation}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-600">No grounded risks recorded.</p>
        )}
      </CardContent>
    </Card>
  );
}

function confidenceLabel(value: IntelligenceRisk["confidence"]): string {
  if (value === "HIGH") return "High confidence";
  if (value === "LOW") return "Low confidence";
  return "Needs review";
}

function PendingDecisionCard({ decisions }: Readonly<{ decisions: PendingDecision[] }>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Decisions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {decisions.length > 0 ? (
          decisions.map((decision) => (
            <div
              key={`${decision.category}-${decision.title}`}
              className="rounded-md border border-slate-200 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="muted">{decision.priority}</Badge>
                <Badge variant="muted">{decision.category.replaceAll("_", " ")}</Badge>
              </div>
              <div className="mt-2 text-sm font-medium text-slate-950">{decision.title}</div>
              <p className="mt-1 text-sm text-slate-600">{decision.description}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-600">No pending decisions found.</p>
        )}
      </CardContent>
    </Card>
  );
}

function EvidenceGallery({
  analyses,
  onOpenEvidence
}: Readonly<{ analyses: PhotoAnalysis[]; onOpenEvidence: (evidenceId: string) => void }>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidence Gallery</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {analyses.length > 0 ? (
          analyses.map((analysis) => (
            <button
              className="w-full rounded-md border border-slate-200 p-3 text-left hover:bg-slate-50"
              key={analysis.id}
              onClick={() => onOpenEvidence(analysis.evidenceId)}
              type="button"
            >
              <div className="text-sm font-medium text-slate-950">{analysis.evidence.filename}</div>
              <p className="mt-1 text-sm text-slate-600">{analysis.summary}</p>
            </button>
          ))
        ) : (
          <p className="text-sm text-slate-600">No recent photo evidence.</p>
        )}
      </CardContent>
    </Card>
  );
}

function MiniSection({ items, title }: Readonly<{ items: IntelligenceBullet[]; title: string }>) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase text-slate-500">{title}</h3>
      <div className="mt-2">
        <BulletList items={items} />
      </div>
    </section>
  );
}

function BulletList({ items }: Readonly<{ items: IntelligenceBullet[] }>) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-600">None recorded.</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li className="text-sm leading-6 text-slate-700" key={item.text}>
          {item.text}
        </li>
      ))}
    </ul>
  );
}

async function downloadMarkdown(projectId: string) {
  const markdown = await api.exportProjectWeeklyReportMarkdown(projectId);
  downloadFile(new Blob([markdown], { type: "text/markdown" }), "weekly-report.md");
}

async function downloadPdf(projectId: string) {
  const pdf = await api.exportProjectWeeklyReportPdf(projectId);
  downloadFile(pdf, "weekly-report.pdf");
}

function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
