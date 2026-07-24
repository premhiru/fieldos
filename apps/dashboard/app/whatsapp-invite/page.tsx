"use client";

import { Button, Card, CardContent, CardHeader, CardTitle, PageContainer } from "@fieldos/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { api } from "../../lib/api";
import { useMe } from "../../lib/queries";

export default function WhatsAppInvitationPage() {
  const [token, setToken] = React.useState("");
  const [acceptedTerms, setAcceptedTerms] = React.useState(false);
  const me = useMe();
  const router = useRouter();
  const queryClient = useQueryClient();
  React.useEffect(
    () => setToken(new URLSearchParams(window.location.hash.slice(1)).get("token") ?? ""),
    []
  );
  const invitation = useQuery({
    enabled: token.length > 0,
    queryFn: () => api.getWhatsAppInvitation(token),
    queryKey: ["whatsapp-invitation", token],
    retry: false
  });
  const accept = useMutation({
    mutationFn: () => api.acceptWhatsAppInvitation(token),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["organizations"] });
      router.replace(`/projects/${result.activation.projectId}`);
    }
  });
  const data = invitation.data?.invitation;
  const authFragment = `whatsappInvite=${encodeURIComponent(token)}`;

  return (
    <PageContainer className="flex min-h-screen items-center justify-center py-8">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Join FieldOS</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {!token || invitation.isLoading ? (
            <p className="text-sm text-[var(--text-secondary)]">
              Checking your secure invitation...
            </p>
          ) : invitation.isError || !data ? (
            <p className="text-sm text-[var(--status-critical-text)]">
              This invitation is invalid or has expired.
            </p>
          ) : (
            <>
              <div>
                <h1 className="text-xl font-semibold text-[var(--text-primary)]">
                  {data.projectName}
                </h1>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {data.personName}, confirm your identity to join {data.organizationName}. WhatsApp
                  participation alone does not create platform access.
                </p>
              </div>
              {me.data?.user ? (
                <div className="space-y-3">
                  <p className="text-sm text-[var(--text-secondary)]">
                    Signed in as {me.data.user.email}
                  </p>
                  <label className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                    <input
                      checked={acceptedTerms}
                      className="mt-1"
                      onChange={(event) => setAcceptedTerms(event.target.checked)}
                      type="checkbox"
                    />{" "}
                    I confirm this is my invitation and accept the FieldOS terms that apply to this
                    workspace.
                  </label>
                  <Button
                    className="w-full"
                    disabled={accept.isPending || !acceptedTerms}
                    onClick={() => accept.mutate()}
                  >
                    {accept.isPending ? "Joining..." : "Accept invitation"}
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Link
                    className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--color-primary)] px-4 text-sm font-medium text-white"
                    href={`/signup#${authFragment}`}
                  >
                    Create account
                  </Link>
                  <Link
                    className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-subtle)] px-4 text-sm font-medium text-[var(--text-primary)]"
                    href={`/login#${authFragment}`}
                  >
                    Log in
                  </Link>
                </div>
              )}
              {accept.isError ? (
                <p className="text-sm text-[var(--status-critical-text)]">
                  {(accept.error as Error).message}
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
