import * as React from "react";

import { cn } from "./utils";

export function PageContainer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <main className={cn("mx-auto w-full max-w-6xl px-6 py-10", className)} {...props} />;
}
