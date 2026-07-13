"use client";

import { Button, Card, CardContent, CardHeader, CardTitle, PageContainer } from "@fieldos/ui";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import * as React from "react";

import { api } from "../../lib/api";

export default function ResetPasswordPage() {
  const [token, setToken] = React.useState<string | null>(null);
  const [isTokenLoaded, setIsTokenLoaded] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const mutation = useMutation({ mutationFn: api.resetPassword });

  React.useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token"));
    setIsTokenLoaded(true);
  }, []);

  return (
    <PageContainer className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
        </CardHeader>
        <CardContent>
          {!isTokenLoaded ? (
            <p className="text-sm text-slate-600">Checking reset link...</p>
          ) : !token ? (
            <div className="space-y-4">
              <p className="text-sm text-red-600">This password reset link is invalid.</p>
              <Link
                className="text-sm font-medium text-slate-950 underline"
                href="/forgot-password"
              >
                Request another reset link
              </Link>
            </div>
          ) : mutation.isSuccess ? (
            <div className="space-y-4">
              <p className="text-sm text-emerald-700">Your password has been updated.</p>
              <Link className="text-sm font-medium text-slate-950 underline" href="/login">
                Log in to FieldOS
              </Link>
            </div>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();

                if (newPassword.length < 8) {
                  setValidationError("Password must contain at least 8 characters.");
                  return;
                }

                if (newPassword !== confirmPassword) {
                  setValidationError("Passwords do not match.");
                  return;
                }

                setValidationError(null);
                mutation.mutate({ newPassword, token });
              }}
            >
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                New password
                <input
                  autoComplete="new-password"
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Confirm new password
                <input
                  autoComplete="new-password"
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
              {validationError ? <p className="text-sm text-red-600">{validationError}</p> : null}
              {mutation.isError ? (
                <div className="space-y-2">
                  <p className="text-sm text-red-600">{(mutation.error as Error).message}</p>
                  <Link
                    className="text-sm font-medium text-slate-950 underline"
                    href="/forgot-password"
                  >
                    Request another reset link
                  </Link>
                </div>
              ) : null}
              <Button disabled={mutation.isPending} type="submit">
                {mutation.isPending ? "Updating..." : "Update password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
