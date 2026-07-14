"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { BrandMark, Skeleton } from "@fieldos/ui";

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
    return (
      <div className="flex min-h-screen bg-[var(--canvas)]">
        <aside className="hidden w-60 border-r border-[var(--border-default)] bg-[var(--surface)] p-5 md:block">
          <BrandMark className="size-9" />
          <div className="mt-9 space-y-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton className="h-10 w-full" key={index} />
            ))}
          </div>
        </aside>
        <main aria-label="Loading workspace" className="flex-1 space-y-6 p-6 sm:p-8">
          <Skeleton className="h-16 w-full max-w-md" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton className="h-28" key={index} />
            ))}
          </div>
          <Skeleton className="h-80 w-full" />
        </main>
      </div>
    );
  }

  if (meQuery.isError) {
    return null;
  }

  return children;
}
