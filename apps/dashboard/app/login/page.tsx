"use client";

import { BrandLockup, Button, Card, CardContent } from "@fieldos/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { z } from "zod";

import { api } from "../../lib/api";
import { authenticateWithInvitation } from "../../lib/auth-flow";

const loginFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [passwordChanged, setPasswordChanged] = React.useState(false);
  const [inviteToken, setInviteToken] = React.useState("");

  React.useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const invite = new URLSearchParams(window.location.hash.slice(1));
    setPasswordChanged(query.get("passwordChanged") === "1");
    setInviteToken(invite.get("invite") ?? "");
    const invitedEmail = invite.get("email");
    if (invitedEmail) setEmail(invitedEmail);
  }, []);

  const mutation = useMutation({
    mutationFn: (body: z.infer<typeof loginFormSchema>) =>
      authenticateWithInvitation(() => api.login(body), inviteToken),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      await queryClient.invalidateQueries({ queryKey: ["organizations"] });
      router.push(inviteToken ? "/projects" : "/");
    }
  });

  return (
    <main className="grid min-h-screen bg-[var(--canvas)] lg:grid-cols-[minmax(340px,0.85fr)_minmax(520px,1.15fr)]">
      <section className="hidden min-h-screen flex-col justify-between bg-[#181c20] p-10 text-white lg:flex xl:p-14">
        <BrandLockup inverted />
        <div className="max-w-lg">
          <div className="mb-7 flex size-12 items-center justify-center rounded-md border border-white/15 bg-white/5">
            <LockKeyhole aria-hidden="true" className="size-5 text-[#8ed7b3]" />
          </div>
          <h1 className="text-4xl font-semibold leading-[1.15] text-white xl:text-5xl">
            Field operations,
            <br />
            intelligently managed.
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-[#b7bdc2]">
            A calm command center for projects, field evidence, decisions, and operational
            follow-through.
          </p>
        </div>
        <p className="text-xs text-[#8d959b]">Secure access to your FieldOS workspace</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <BrandLockup />
          </div>
          <div className="mb-7">
            <p className="text-sm font-medium text-[var(--text-tertiary)]">Welcome back</p>
            <h2 className="mt-1 text-2xl font-semibold leading-8 text-[var(--text-primary)]">
              Log in to FieldOS
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Continue to your operations workspace.
            </p>
          </div>

          <Card>
            <CardContent className="pt-5 sm:pt-6">
              <form
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const parsed = loginFormSchema.safeParse({ email, password });
                  if (!parsed.success) {
                    setValidationError("Enter a valid email and password.");
                    return;
                  }
                  setValidationError(null);
                  mutation.mutate(parsed.data);
                }}
              >
                <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text-secondary)]">
                  Email
                  <input
                    autoComplete="email"
                    className="h-11 rounded-md border px-3 text-sm"
                    type="email"
                    readOnly={Boolean(inviteToken)}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text-secondary)]">
                  <span className="flex items-center justify-between gap-3">
                    Password
                    <Link
                      className="font-normal text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      href="/forgot-password"
                    >
                      Forgot password?
                    </Link>
                  </span>
                  <input
                    autoComplete="current-password"
                    className="h-11 rounded-md border px-3 text-sm"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
                {validationError ? (
                  <p className="text-sm text-[var(--status-critical-text)]">{validationError}</p>
                ) : null}
                {passwordChanged ? (
                  <div className="flex gap-2 rounded-md border border-[var(--status-healthy-border)] bg-[var(--status-healthy-soft)] p-3 text-sm text-[var(--status-healthy-text)]">
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    Password updated. Log in with your new password.
                  </div>
                ) : null}
                {mutation.isError ? (
                  <p className="text-sm text-[var(--status-critical-text)]">
                    {(mutation.error as Error).message}
                  </p>
                ) : null}
                <Button className="mt-1 h-11 w-full" disabled={mutation.isPending} type="submit">
                  {mutation.isPending ? "Logging in..." : "Log in"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
            New to FieldOS?{" "}
            <Link
              className="font-medium text-[var(--text-primary)] hover:underline"
              href={
                inviteToken
                  ? `/signup#invite=${encodeURIComponent(inviteToken)}&email=${encodeURIComponent(email)}`
                  : "/signup"
              }
            >
              Create an account
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
