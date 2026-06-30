"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { useMe } from "../lib/queries";

export function AuthGuard({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const meQuery = useMe();

  React.useEffect(() => {
    if (meQuery.isError) {
      router.replace("/login");
    }
  }, [meQuery.isError, router]);

  if (meQuery.isLoading) {
    return <div className="p-6 text-sm text-slate-600">Loading...</div>;
  }

  if (meQuery.isError) {
    return null;
  }

  return children;
}
