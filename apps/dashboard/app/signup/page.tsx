"use client";

import { Button, Card, CardContent, CardHeader, CardTitle, PageContainer } from "@fieldos/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { z } from "zod";

import { api } from "../../lib/api";

const signupFormSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1),
  password: z.string().min(8)
});

export default function SignupPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [inviteToken, setInviteToken] = React.useState("");
  const [validationError, setValidationError] = React.useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: api.signup,
    onSuccess: async () => {
      if (inviteToken) {
        await api.acceptInvitation(inviteToken);
      }
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      await queryClient.invalidateQueries({ queryKey: ["organizations"] });
      router.push(inviteToken ? "/projects" : "/");
    }
  });

  React.useEffect(() => {
    const query = new URLSearchParams(window.location.hash.slice(1));
    const invitedEmail = query.get("email");
    setInviteToken(query.get("invite") ?? "");
    if (invitedEmail) setEmail(invitedEmail);
  }, []);

  return (
    <PageContainer className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your FieldOS account</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const parsed = signupFormSchema.safeParse({ email, name, password });

              if (!parsed.success) {
                setValidationError(
                  "Enter a name, valid email, and password with at least 8 characters."
                );
                return;
              }

              setValidationError(null);
              mutation.mutate(parsed.data);
            }}
          >
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Name
              <input
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Email
              <input
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                type="email"
                readOnly={Boolean(inviteToken)}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Password
              <input
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {validationError ? <p className="text-sm text-red-600">{validationError}</p> : null}
            {mutation.isError ? (
              <p className="text-sm text-red-600">{(mutation.error as Error).message}</p>
            ) : null}
            <Button disabled={mutation.isPending} type="submit">
              {mutation.isPending ? "Creating account..." : "Sign up"}
            </Button>
            <p className="text-sm text-slate-600">
              Already have an account?{" "}
              <Link
                className="font-medium text-slate-950 underline"
                href={
                  inviteToken
                    ? `/login#invite=${encodeURIComponent(inviteToken)}&email=${encodeURIComponent(email)}`
                    : "/login"
                }
              >
                Log in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
