"use client";

import { Button, Card, CardContent, CardHeader, CardTitle, PageContainer } from "@fieldos/ui";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import * as React from "react";
import { z } from "zod";

import { api } from "../../lib/api";

const forgotPasswordFormSchema = z.object({
  email: z.string().email()
});

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const mutation = useMutation({ mutationFn: api.forgotPassword });

  return (
    <PageContainer className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
        </CardHeader>
        <CardContent>
          {mutation.isSuccess ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-700">{mutation.data.message}</p>
              {mutation.data.resetUrl ? (
                <Link
                  className="text-sm font-medium text-slate-950 underline"
                  href={mutation.data.resetUrl}
                >
                  Open development reset link
                </Link>
              ) : null}
              <Link className="block text-sm font-medium text-slate-950 underline" href="/login">
                Return to login
              </Link>
            </div>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                const parsed = forgotPasswordFormSchema.safeParse({ email });

                if (!parsed.success) {
                  setValidationError("Enter a valid email address.");
                  return;
                }

                setValidationError(null);
                mutation.mutate(parsed.data);
              }}
            >
              <p className="text-sm text-slate-600">
                Enter your account email and we will send a link that expires in one hour.
              </p>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Email
                <input
                  autoComplete="email"
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              {validationError ? <p className="text-sm text-red-600">{validationError}</p> : null}
              {mutation.isError ? (
                <p className="text-sm text-red-600">{(mutation.error as Error).message}</p>
              ) : null}
              <Button disabled={mutation.isPending} type="submit">
                {mutation.isPending ? "Sending..." : "Send reset link"}
              </Button>
              <Link className="text-sm font-medium text-slate-950 underline" href="/login">
                Return to login
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
