"use client";

import { Button, Card, CardContent, CardHeader, CardTitle, PageContainer } from "@fieldos/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { z } from "zod";

import { api } from "../../lib/api";

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

  const mutation = useMutation({
    mutationFn: api.login,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.push("/");
    }
  });

  return (
    <PageContainer className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Log in to FieldOS</CardTitle>
        </CardHeader>
        <CardContent>
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
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Email
              <input
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                type="email"
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
              {mutation.isPending ? "Logging in..." : "Log in"}
            </Button>
            <p className="text-sm text-slate-600">
              New to FieldOS?{" "}
              <Link className="font-medium text-slate-950 underline" href="/signup">
                Sign up
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
