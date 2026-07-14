import * as React from "react";

import { cn } from "./utils";

export function PageContainer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <main
      className={cn(
        "mx-auto w-full max-w-[1440px] px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:px-8 md:pb-10",
        className
      )}
      {...props}
    />
  );
}
