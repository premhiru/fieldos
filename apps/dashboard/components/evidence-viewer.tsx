"use client";

import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@fieldos/ui";
import { useQuery } from "@tanstack/react-query";

import { api, type EvidenceView } from "../lib/api";

export function EvidenceViewer({
  evidenceId,
  onClose
}: Readonly<{
  evidenceId: string | null;
  onClose: () => void;
}>) {
  const evidenceQuery = useQuery({
    enabled: Boolean(evidenceId),
    queryFn: () => api.getEvidenceView(evidenceId ?? ""),
    queryKey: ["evidence-view", evidenceId]
  });

  if (!evidenceId) {
    return null;
  }

  const evidence = evidenceQuery.data?.evidence;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30">
      <div className="ml-auto flex h-full w-full max-w-3xl flex-col overflow-y-auto bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <div className="text-sm font-medium text-slate-500">Evidence Viewer</div>
            <h2 className="text-lg font-semibold text-slate-950">
              {evidence?.filename ?? "Loading evidence"}
            </h2>
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="space-y-4 p-6">
          {evidenceQuery.isLoading ? (
            <Card>
              <CardContent className="space-y-3 pt-6" aria-label="Loading evidence">
                <Skeleton className="aspect-video w-full" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ) : evidenceQuery.isError || !evidence ? (
            <Card>
              <CardContent className="pt-6 text-sm text-red-700">
                Unable to load evidence.
              </CardContent>
            </Card>
          ) : (
            <EvidenceViewerBody evidence={evidence} />
          )}
        </div>
      </div>
    </div>
  );
}

function EvidenceViewerBody({ evidence }: Readonly<{ evidence: EvidenceView }>) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <MediaPreview evidence={evidence} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Source Message</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
          <div>{evidence.sourceWhatsAppMessage.conversationTitle}</div>
          <div className="rounded-md bg-slate-50 p-3">
            {evidence.message.body ?? "No text body."}
          </div>
          <div className="text-xs text-slate-500">
            {new Date(evidence.message.occurredAt).toLocaleString()}
          </div>
        </CardContent>
      </Card>

      {evidence.transcript ? (
        <Card>
          <CardHeader>
            <CardTitle>Transcript</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-700">{evidence.transcript}</CardContent>
        </Card>
      ) : null}

      {evidence.photoAnalysis ? (
        <Card>
          <CardHeader>
            <CardTitle>Vision Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <p>{evidence.photoAnalysis.summary}</p>
            <InfoList title="Detected" values={evidence.photoAnalysis.detectedObjects} />
            <InfoList title="Possible Issues" values={evidence.photoAnalysis.possibleIssues} />
            <InfoList title="Tags" values={evidence.photoAnalysis.tags} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Timeline References</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {evidence.timelineEvents.length > 0 ? (
            evidence.timelineEvents.map((event) => (
              <div key={event.id} className="rounded-md border border-slate-200 p-3">
                <div className="text-sm font-medium text-slate-950">{event.title}</div>
                <div className="text-sm text-slate-600">
                  {event.description ?? "No description."}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {new Date(event.occurredAt).toLocaleString()}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-600">No timeline references yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Linked Action Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {evidence.actionItems.length > 0 ? (
            evidence.actionItems.map((item) => (
              <div key={item.id} className="rounded-md border border-slate-200 p-3">
                <div className="text-sm font-medium text-slate-950">{item.title}</div>
                <div className="text-sm text-slate-600">{item.description ?? item.status}</div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-600">No linked Action Items.</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function MediaPreview({ evidence }: Readonly<{ evidence: EvidenceView }>) {
  if (evidence.mimeType.startsWith("image/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={evidence.filename}
        className="h-auto max-h-[520px] w-full rounded-md border border-slate-200 object-contain"
        src={evidence.signedUrl}
      />
    );
  }

  if (evidence.mimeType === "application/pdf") {
    return (
      <iframe
        className="h-[520px] w-full rounded-md border border-slate-200"
        src={evidence.signedUrl}
        title={evidence.filename}
      />
    );
  }

  if (evidence.mimeType.startsWith("audio/")) {
    return <audio className="w-full" controls src={evidence.signedUrl} />;
  }

  return (
    <a
      className="inline-flex rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white"
      href={evidence.signedUrl}
      rel="noreferrer"
      target="_blank"
    >
      Open Evidence
    </a>
  );
}

function InfoList({ title, values }: Readonly<{ title: string; values: string[] }>) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-slate-500">{title}</div>
      <div className="mt-1 text-sm text-slate-700">
        {values.length > 0 ? values.join(", ") : "None recorded."}
      </div>
    </div>
  );
}
