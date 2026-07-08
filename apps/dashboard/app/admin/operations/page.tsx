"use client";

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@fieldos/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { AppShell } from "../../../components/app-shell";
import { AuthGuard } from "../../../components/auth-guard";
import { OrganizationOnboarding } from "../../../components/organization-onboarding";
import { OrganizationSelector } from "../../../components/organization-selector";
import {
  api,
  type AdminOperations,
  type JobMetrics,
  type ProcessingJob,
  type WorkerHeartbeat
} from "../../../lib/api";
import { useOrganizations } from "../../../lib/queries";
import { useActiveOrganizationStore } from "../../../store/active-organization-store";

export default function OperationsHealthPage() {
  return (
    <AuthGuard>
      <AppShell>
        <OperationsHealthContent />
      </AppShell>
    </AuthGuard>
  );
}

function OperationsHealthContent() {
  const queryClient = useQueryClient();
  const organizationsQuery = useOrganizations();
  const organizations = organizationsQuery.data?.organizations ?? [];
  const { activeOrganizationId, setActiveOrganizationId } = useActiveOrganizationStore();
  const activeOrganization =
    organizations.find((organization) => organization.id === activeOrganizationId) ??
    organizations[0];
  const canAccess = activeOrganization?.role === "OWNER" || activeOrganization?.role === "ADMIN";
  const operationsQuery = useQuery({
    enabled: Boolean(activeOrganization?.id && canAccess),
    queryFn: () => api.getAdminOperations(activeOrganization?.id ?? ""),
    queryKey: ["admin-operations", activeOrganization?.id],
    refetchInterval: 15_000,
    retry: false
  });
  const jobsQuery = useQuery({
    enabled: Boolean(activeOrganization?.id && canAccess),
    queryFn: () => api.listAdminJobs(activeOrganization?.id ?? ""),
    queryKey: ["admin-jobs", activeOrganization?.id],
    refetchInterval: 15_000,
    retry: false
  });
  const retryJobMutation = useMutation({
    mutationFn: (jobId: string) => api.retryAdminJob(jobId),
    onSuccess: async () => {
      await invalidateOperations(queryClient, activeOrganization?.id);
    }
  });
  const retryFailedMutation = useMutation({
    mutationFn: () => api.retryFailedAdminJobs(activeOrganization?.id ?? ""),
    onSuccess: async () => {
      await invalidateOperations(queryClient, activeOrganization?.id);
    }
  });

  React.useEffect(() => {
    if (!activeOrganizationId && organizations[0]) {
      setActiveOrganizationId(organizations[0].id);
    }
  }, [activeOrganizationId, organizations, setActiveOrganizationId]);

  if (organizationsQuery.isLoading) {
    return <p className="text-sm text-slate-600">Loading operations...</p>;
  }

  if (organizations.length === 0) {
    return <OrganizationOnboarding />;
  }

  if (!canAccess) {
    return (
      <div className="space-y-6">
        <Header />
        <Card>
          <CardContent className="p-6 text-sm text-slate-600">
            Only organization owners and admins can access operations health.
          </CardContent>
        </Card>
      </div>
    );
  }

  const operations = operationsQuery.data?.operations;
  const jobs = jobsQuery.data?.jobs ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Header />
        <OrganizationSelector organizations={organizations} />
      </div>

      {operationsQuery.isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-red-700">
            Unable to load operations health.
          </CardContent>
        </Card>
      ) : null}

      {operations ? (
        <>
          <WorkerStatusTable workers={operations.workers} />
          <JobSummaryTable rows={operations.jobSummary} />
          <SystemCards operations={operations} />
          <JobsTable
            jobs={jobs}
            retryFailed={() => retryFailedMutation.mutate()}
            retryFailedPending={retryFailedMutation.isPending}
            retryJob={(jobId) => retryJobMutation.mutate(jobId)}
            retryJobPending={retryJobMutation.isPending}
          />
        </>
      ) : (
        <p className="text-sm text-slate-600">Loading health checks...</p>
      )}
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-950">Operations Health</h1>
      <p className="text-sm text-slate-600">Background jobs, worker heartbeat, and queues.</p>
    </div>
  );
}

function WorkerStatusTable({ workers }: { workers: WorkerHeartbeat[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Worker Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-4">Worker</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Heartbeat</th>
                <th className="py-2 pr-4">Version</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {workers.map((worker) => (
                <tr key={worker.id}>
                  <td className="py-3 pr-4 font-medium text-slate-950">{worker.workerName}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={worker.status} />
                  </td>
                  <td className="py-3 pr-4 text-slate-600">
                    {formatDateTime(worker.lastHeartbeatAt)}
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-slate-500">{worker.version}</td>
                </tr>
              ))}
              {workers.length === 0 ? (
                <tr>
                  <td className="py-4 text-slate-600" colSpan={4}>
                    No worker heartbeat has been recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function JobSummaryTable({ rows }: { rows: JobMetrics[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Job Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-4">Job Type</th>
                <th className="py-2 pr-4">Pending</th>
                <th className="py-2 pr-4">Running</th>
                <th className="py-2 pr-4">Failed</th>
                <th className="py-2 pr-4">Completed Today</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((row) => (
                <tr key={row.type}>
                  <td className="py-3 pr-4 font-medium text-slate-950">
                    {formatJobType(row.type)}
                  </td>
                  <td className="py-3 pr-4">{row.pending}</td>
                  <td className="py-3 pr-4">{row.running}</td>
                  <td className="py-3 pr-4">{row.failed}</td>
                  <td className="py-3 pr-4">{row.completedToday}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function SystemCards({ operations }: { operations: AdminOperations }) {
  const cards = [
    {
      title: "WhatsApp",
      rows: [
        ["Connected Accounts", operations.whatsApp.connectedAccounts],
        ["Disconnected Accounts", operations.whatsApp.disconnectedAccounts],
        ["QR Pending", operations.whatsApp.qrPending],
        ["Failed Connections", operations.whatsApp.failedConnections]
      ]
    },
    {
      title: "AI",
      rows: [
        ["Jobs Pending", operations.ai.jobsPending],
        [
          "Average Processing Time",
          operations.ai.averageProcessingTimeMs
            ? `${operations.ai.averageProcessingTimeMs} ms`
            : "No completions today"
        ],
        ["Failures Today", operations.ai.failuresToday]
      ]
    },
    {
      title: "Search",
      rows: [
        ["Pending Index Jobs", operations.search.pendingIndexJobs],
        ["Completed Today", operations.search.completedToday]
      ]
    },
    {
      title: "Media",
      rows: [
        ["Pending Downloads", operations.media.pendingDownloads],
        ["Pending Transcriptions", operations.media.pendingTranscriptions],
        ["Pending Photo Analysis", operations.media.pendingPhotoAnalyses],
        ["Failed Downloads", operations.media.failedDownloads]
      ]
    },
    {
      title: "Coordinators",
      rows: [
        ["Runs Today", operations.coordinators.runsToday],
        ["Failed Runs", operations.coordinators.failedRunsToday],
        ["Created Today", operations.coordinators.recommendationsCreatedToday],
        ["Pending Recommendations", operations.coordinators.pendingRecommendations],
        ["Approval Rate", `${operations.coordinators.approvalRate}%`]
      ]
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader>
            <CardTitle>{card.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {card.rows.map(([label, value]) => (
                <div className="flex items-center justify-between gap-4" key={label}>
                  <dt className="text-slate-600">{label}</dt>
                  <dd className="font-semibold text-slate-950">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function JobsTable({
  jobs,
  retryFailed,
  retryFailedPending,
  retryJob,
  retryJobPending
}: {
  jobs: ProcessingJob[];
  retryFailed: () => void;
  retryFailedPending: boolean;
  retryJob: (jobId: string) => void;
  retryJobPending: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <CardTitle>Recent Jobs</CardTitle>
        <Button disabled={retryFailedPending} onClick={retryFailed}>
          Retry Failed
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Attempts</th>
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4">Updated</th>
                <th className="py-2 pr-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="py-3 pr-4 font-medium text-slate-950">
                    {formatJobType(job.type)}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="py-3 pr-4 text-slate-600">
                    {job.attempts}/{job.maxAttempts}
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-slate-500">
                    {job.sourceType}:{job.sourceId.slice(0, 10)}
                  </td>
                  <td className="py-3 pr-4 text-slate-600">{formatDateTime(job.updatedAt)}</td>
                  <td className="py-3 pr-4">
                    {job.status === "FAILED" ? (
                      <Button disabled={retryJobPending} onClick={() => retryJob(job.id)}>
                        Retry
                      </Button>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {jobs.length === 0 ? (
                <tr>
                  <td className="py-4 text-slate-600" colSpan={6}>
                    No jobs have been recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "ONLINE" || status === "COMPLETED"
      ? "success"
      : status === "FAILED" || status === "OFFLINE"
        ? "warning"
        : "muted";

  return <Badge variant={tone}>{status.replaceAll("_", " ")}</Badge>;
}

function formatJobType(type: string) {
  return type
    .toLowerCase()
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

async function invalidateOperations(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string | undefined
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["admin-operations", organizationId] }),
    queryClient.invalidateQueries({ queryKey: ["admin-jobs", organizationId] })
  ]);
}
