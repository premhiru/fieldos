"use client";

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@fieldos/ui";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import * as React from "react";

import { AppShell } from "../../components/app-shell";
import { AuthGuard } from "../../components/auth-guard";
import { OrganizationOnboarding } from "../../components/organization-onboarding";
import { OrganizationSelector } from "../../components/organization-selector";
import { api, type SearchResult, type SearchSourceType } from "../../lib/api";
import { useOrganizations, useProjects } from "../../lib/queries";
import { useActiveOrganizationStore } from "../../store/active-organization-store";

const exampleQuestions = [
  "Show all defects this week.",
  "What happened on Taxiway Alpha?",
  "Which projects need attention?",
  "Show messages about CCR testing.",
  "What action items are still pending?"
];

const sourceTypes: Array<{ label: string; value: SearchSourceType | "" }> = [
  { label: "All sources", value: "" },
  { label: "Projects", value: "PROJECT" },
  { label: "Messages", value: "MESSAGE" },
  { label: "Timeline Events", value: "TIMELINE_EVENT" },
  { label: "Action Items", value: "ACTION_ITEM" },
  { label: "AI Classifications", value: "AI_CLASSIFICATION" },
  { label: "Photo Analysis", value: "PHOTO_ANALYSIS" }
];

export default function SearchPage() {
  return (
    <AuthGuard>
      <AppShell>
        <SearchContent />
      </AppShell>
    </AuthGuard>
  );
}

function SearchContent() {
  const organizationsQuery = useOrganizations();
  const { activeOrganizationId, setActiveOrganizationId } = useActiveOrganizationStore();
  const organizations = organizationsQuery.data?.organizations ?? [];
  const selectedOrganization =
    organizations.find((organization) => organization.id === activeOrganizationId) ??
    organizations[0];
  const projectsQuery = useProjects(selectedOrganization?.id ?? null);
  const projects = projectsQuery.data?.projects ?? [];
  const [query, setQuery] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [sourceType, setSourceType] = React.useState<SearchSourceType | "">("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const searchMutation = useMutation({
    mutationFn: () =>
      api.search({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: 10,
        organizationId: selectedOrganization?.id ?? "",
        projectId: projectId || null,
        q: query,
        type: sourceType
      })
  });
  const askMutation = useMutation({
    mutationFn: () =>
      api.askSearch({
        organizationId: selectedOrganization?.id ?? "",
        projectId: projectId || null,
        question: query
      })
  });

  React.useEffect(() => {
    if (!activeOrganizationId && organizations[0]) {
      setActiveOrganizationId(organizations[0].id);
    }
  }, [activeOrganizationId, organizations, setActiveOrganizationId]);

  if (organizationsQuery.isLoading) {
    return <p className="text-sm text-slate-600">Loading search...</p>;
  }

  if (organizations.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-slate-950">Search</h1>
        <OrganizationOnboarding />
      </div>
    );
  }

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!query.trim()) {
      return;
    }

    searchMutation.mutate();
    askMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Search</h1>
          <p className="text-sm text-slate-600">Ask grounded questions across FieldOS records.</p>
        </div>
        <OrganizationSelector organizations={organizations} />
      </div>

      <Card>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="flex flex-col gap-3 lg:flex-row">
              <input
                className="h-11 flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ask about projects, messages, defects, inspections, or action items..."
                value={query}
              />
              <Button disabled={!query.trim() || searchMutation.isPending || askMutation.isPending}>
                Search
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <select
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                onChange={(event) => setProjectId(event.target.value)}
                value={projectId}
              >
                <option value="">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                onChange={(event) => setSourceType(event.target.value as SearchSourceType | "")}
                value={sourceType}
              >
                {sourceTypes.map((type) => (
                  <option key={type.value || "all"} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <input
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                onChange={(event) => setDateFrom(event.target.value)}
                type="date"
                value={dateFrom}
              />
              <input
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                onChange={(event) => setDateTo(event.target.value)}
                type="date"
                value={dateTo}
              />
            </div>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            {exampleQuestions.map((example) => (
              <button
                className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                key={example}
                onClick={() => setQuery(example)}
                type="button"
              >
                {example}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent>
            {searchMutation.isPending ? (
              <p className="text-sm text-slate-600">Searching...</p>
            ) : searchMutation.data?.results.length ? (
              <div className="space-y-3">
                {searchMutation.data.results.map((result) => (
                  <ResultCard key={result.id} result={result} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">No search results yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Answer</CardTitle>
          </CardHeader>
          <CardContent>
            {askMutation.isPending ? (
              <p className="text-sm text-slate-600">Grounding answer...</p>
            ) : askMutation.data ? (
              <div className="space-y-4">
                <p className="text-sm leading-6 text-slate-800">{askMutation.data.answer}</p>
                <Badge variant="muted">{askMutation.data.confidence} Confidence</Badge>
                <div className="space-y-2">
                  {askMutation.data.sources.map((source) => (
                    <div
                      className="rounded-md border border-slate-200 p-2 text-xs text-slate-600"
                      key={`${source.sourceType}-${source.sourceId}`}
                    >
                      <div className="font-medium text-slate-950">{source.title}</div>
                      <div>{source.snippet}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                Ask a question to generate a grounded answer.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ResultCard({ result }: Readonly<{ result: SearchResult }>) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="muted">{formatSourceType(result.sourceType)}</Badge>
            {result.project ? (
              <span className="text-xs text-slate-500">{result.project.name}</span>
            ) : null}
          </div>
          <h2 className="mt-2 font-medium text-slate-950">{result.title}</h2>
          <p className="mt-1 text-sm text-slate-600">{result.snippet}</p>
          <p className="mt-2 text-xs text-slate-500">
            {formatDate(result.occurredAt ?? result.createdAt)}
          </p>
        </div>
        <Link
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-slate-100 px-3 text-xs font-medium text-slate-950 hover:bg-slate-200"
          href={getSourceHref(result)}
        >
          Open Source
        </Link>
      </div>
    </div>
  );
}

function getSourceHref(result: SearchResult): string {
  if (result.sourceType === "PROJECT") {
    return `/projects/${result.sourceId}`;
  }

  if (result.sourceType === "MESSAGE") {
    const metadata = result.metadata as { conversationId?: string } | null;
    return metadata?.conversationId ? `/inbox/${metadata.conversationId}` : "/inbox";
  }

  if (result.sourceType === "PHOTO_ANALYSIS") {
    return result.projectId ? `/projects/${result.projectId}` : "/search";
  }

  return result.projectId ? `/projects/${result.projectId}` : "/search";
}

function formatSourceType(sourceType: SearchSourceType): string {
  return sourceType
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
