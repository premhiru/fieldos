"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageContainer
} from "@fieldos/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { api } from "../../lib/api";
import { useMe } from "../../lib/queries";

export default function InvitationPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const meQuery = useMe();
  const [token, setToken] = React.useState("");

  React.useEffect(() => {
    setToken(new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "");
  }, []);

  const invitationQuery = useQuery({
    enabled: token.length > 0,
    queryFn: () => api.getInvitation(token),
    queryKey: ["team-invitation", token],
    retry: false
  });
  const acceptMutation = useMutation({
    mutationFn: () => api.acceptInvitation(token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["organizations"] });
      router.replace("/projects");
    }
  });

  const invitation = invitationQuery.data?.invitation;
  const authFragment = new URLSearchParams({
    email: invitation?.email ?? "",
    invite: token
  }).toString();

  return (
    <PageContainer className="flex min-h-screen items-center justify-center py-8">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Join FieldOS</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {!token || invitationQuery.isLoading ? (
            <p className="text-sm text-slate-600">Loading invitation...</p>
          ) : invitationQuery.isError || !invitation ? (
            <div className="space-y-3">
              <p className="text-sm text-red-700">This invitation is invalid or unavailable.</p>
              <Link className="text-sm font-medium text-slate-950 underline" href="/login">
                Return to login
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Badge>{invitation.role}</Badge>
                <h1 className="text-xl font-semibold text-slate-950">
                  {invitation.organization.name}
                </h1>
                <p className="text-sm text-slate-600">
                  This invitation is for <strong>{invitation.email}</strong>.
                </p>
              </div>

              <div className="border-y border-slate-200 py-4">
                <p className="mb-2 text-sm font-medium text-slate-800">Project access</p>
                {invitation.role === "ADMIN" ? (
                  <p className="text-sm text-slate-600">All organization projects</p>
                ) : invitation.projects.length > 0 ? (
                  <ul className="space-y-1 text-sm text-slate-700">
                    {invitation.projects.map((project) => (
                      <li key={project.id}>{project.name}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-600">No projects assigned yet</p>
                )}
              </div>

              {invitation.status !== "PENDING" ? (
                <p className="text-sm text-amber-800">
                  This invitation is {invitation.status.toLowerCase()}.
                </p>
              ) : meQuery.data?.user ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">Signed in as {meQuery.data.user.email}</p>
                  <Button
                    className="w-full"
                    disabled={acceptMutation.isPending}
                    onClick={() => acceptMutation.mutate()}
                  >
                    {acceptMutation.isPending ? "Joining..." : "Accept invitation"}
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Link
                    className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
                    href={`/signup#${authFragment}`}
                  >
                    Create account
                  </Link>
                  <Link
                    className="inline-flex h-10 items-center justify-center rounded-md bg-slate-100 px-4 text-sm font-medium text-slate-950 hover:bg-slate-200"
                    href={`/login#${authFragment}`}
                  >
                    Log in
                  </Link>
                </div>
              )}

              {acceptMutation.isError ? (
                <p className="text-sm text-red-700">{(acceptMutation.error as Error).message}</p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
