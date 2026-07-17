"use client";

import { Badge, Button, EmptyState, PageHeader, Skeleton } from "@fieldos/ui";
import { Clock3, Search as SearchIcon, Sparkles } from "lucide-react";
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

const suggestedSearches = [
  "Which projects need attention?",
  "What changed this week?",
  "Show pending approvals",
  "Where are the current delays?"
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
  const organization =
    organizations.find((item) => item.id === activeOrganizationId) ?? organizations[0];
  const projectsQuery = useProjects(organization?.id ?? null);
  const [query, setQuery] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [recentSearches, setRecentSearches] = React.useState<string[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const searchMutation = useMutation({
    mutationFn: () =>
      api.search({
        limit: 20,
        organizationId: organization?.id ?? "",
        projectId: projectId || null,
        q: query,
        type: ""
      })
  });
  const askMutation = useMutation({
    mutationFn: () =>
      api.askSearch({
        organizationId: organization?.id ?? "",
        projectId: projectId || null,
        question: query
      })
  });

  React.useEffect(() => {
    if (!activeOrganizationId && organizations[0]) setActiveOrganizationId(organizations[0].id);
  }, [activeOrganizationId, organizations, setActiveOrganizationId]);

  React.useEffect(() => {
    setRecentSearches(
      JSON.parse(window.localStorage.getItem("fieldos-recent-searches") ?? "[]") as string[]
    );
    inputRef.current?.focus();
  }, []);

  if (organizationsQuery.isLoading) return <Skeleton className="h-[620px]" />;
  if (organizations.length === 0) return <OrganizationOnboarding />;

  function runSearch(value = query) {
    const nextQuery = value.trim();
    if (!nextQuery) return;
    setQuery(nextQuery);
    const nextRecent = [nextQuery, ...recentSearches.filter((item) => item !== nextQuery)].slice(
      0,
      5
    );
    setRecentSearches(nextRecent);
    window.localStorage.setItem("fieldos-recent-searches", JSON.stringify(nextRecent));
    searchMutation.mutate();
    askMutation.mutate();
  }

  const results = searchMutation.data?.results ?? [];
  const messages = results.filter((item) => item.sourceType === "MESSAGE");
  const events = results.filter((item) => item.sourceType === "TIMELINE_EVENT");
  const evidence = results.filter(
    (item) => item.sourceType !== "MESSAGE" && item.sourceType !== "TIMELINE_EVENT"
  );

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <PageHeader
        actions={<OrganizationSelector organizations={organizations} />}
        description="Ask a question across projects, messages, evidence, and reports."
        title="Search FieldOS"
      />

      <section>
        <form
          className="rounded-lg border border-slate-300 bg-white p-3 shadow-sm focus-within:border-slate-950"
          onSubmit={(event) => {
            event.preventDefault();
            runSearch();
          }}
        >
          <div className="flex items-center gap-3">
            <SearchIcon aria-hidden="true" className="ml-2 size-5 shrink-0 text-slate-400" />
            <input
              className="h-12 min-w-0 flex-1 border-0 bg-transparent text-base text-slate-950 outline-none"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ask about project progress, delays, evidence, or decisions"
              ref={inputRef}
              value={query}
            />
            <Button disabled={!query.trim() || searchMutation.isPending || askMutation.isPending}>
              Ask
            </Button>
          </div>
          <div className="mt-2 border-t border-slate-100 px-2 pt-3">
            <label className="flex items-center gap-2 text-xs text-slate-500">
              Project
              <select
                className="h-8 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700"
                onChange={(event) => setProjectId(event.target.value)}
                value={projectId}
              >
                <option value="">All projects</option>
                {(projectsQuery.data?.projects ?? []).map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </form>

        {!askMutation.data && !askMutation.isPending ? (
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <SearchSuggestions
              icon={<Sparkles aria-hidden="true" className="size-4" />}
              items={suggestedSearches}
              onSelect={runSearch}
              title="Suggested"
            />
            <SearchSuggestions
              icon={<Clock3 aria-hidden="true" className="size-4" />}
              items={recentSearches}
              onSelect={runSearch}
              title="Recent"
            />
          </div>
        ) : null}
      </section>

      {askMutation.isPending ? (
        <AnswerSkeleton />
      ) : askMutation.data ? (
        <section aria-live="polite" className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
            <Sparkles aria-hidden="true" className="size-4" />
            FieldOS answer
          </div>
          <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-6 sm:p-8">
            <p className="text-base leading-8 text-slate-900">{askMutation.data.answer}</p>
            <div className="mt-5">
              <ConfidenceBadge value={askMutation.data.confidence} />
            </div>
          </div>
        </section>
      ) : null}

      {askMutation.data ? (
        <ResultSection
          results={askMutation.data.sources.map((source) => ({
            ...source,
            createdAt: "",
            id: `${source.sourceType}-${source.sourceId}`,
            metadata: null,
            occurredAt: null,
            organizationId: organization?.id ?? "",
            project: null,
            projectId: null,
            sourceId: source.sourceId,
            snippet: source.snippet,
            sourceType: source.sourceType as SearchSourceType,
            title: source.title,
            updatedAt: ""
          }))}
          title="Supporting Evidence"
        />
      ) : null}
      {messages.length > 0 ? <ResultSection results={messages} title="Related Messages" /> : null}
      {events.length > 0 ? (
        <ResultSection results={events} title="Related Timeline Events" />
      ) : null}
      {evidence.length > 0 ? <ResultSection results={evidence} title="Related Records" /> : null}

      {searchMutation.isSuccess && results.length === 0 ? (
        <EmptyState
          description="Try a project name, location, milestone, or a shorter operational question."
          icon={<SearchIcon aria-hidden="true" className="size-5" />}
          title="No supporting records found"
        />
      ) : null}
    </div>
  );
}

function SearchSuggestions({
  icon,
  items,
  onSelect,
  title
}: {
  icon: React.ReactNode;
  items: string[];
  onSelect: (value: string) => void;
  title: string;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
        {icon}
        {title}
      </div>
      <div className="mt-3 space-y-1">
        {items.map((item) => (
          <button
            className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-950"
            key={item}
            onClick={() => onSelect(item)}
            type="button"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function ResultSection({ results, title }: { results: SearchResult[]; title: string }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {results.map((result) => (
          <ResultRow key={result.id} result={result} />
        ))}
      </div>
    </section>
  );
}

function ResultRow({ result }: { result: SearchResult }) {
  return (
    <Link className="block p-4 hover:bg-slate-50 sm:p-5" href={sourceHref(result)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="muted">{formatLabel(result.sourceType)}</Badge>
        {result.project ? (
          <span className="text-xs text-slate-500">{result.project.name}</span>
        ) : null}
      </div>
      <h3 className="mt-2 font-medium text-slate-950">{result.title}</h3>
      <p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-600">{result.snippet}</p>
    </Link>
  );
}

function ConfidenceBadge({ value }: { value: string }) {
  return (
    <Badge variant={value === "LOW" ? "warning" : value === "HIGH" ? "success" : "muted"}>
      {value === "HIGH"
        ? "High confidence"
        : value === "MEDIUM"
          ? "Needs review"
          : "Low confidence"}
    </Badge>
  );
}

function AnswerSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-44 w-full" />
    </div>
  );
}

function sourceHref(result: SearchResult) {
  if (result.sourceType === "PROJECT") return `/projects/${result.sourceId}`;
  if (result.sourceType === "MESSAGE") {
    const metadata = result.metadata as { conversationId?: string } | null;
    return metadata?.conversationId ? `/inbox/${metadata.conversationId}` : "/inbox";
  }
  return result.projectId ? `/projects/${result.projectId}` : "/search";
}

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
