import * as React from "react";

import { cn } from "./utils";

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  action?: React.ReactNode;
  description: string;
  icon?: React.ReactNode;
  title: string;
}

export function EmptyState({
  action,
  className,
  description,
  icon,
  title,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}
      {...props}
    >
      <div className="relative mb-5 flex h-16 w-24 items-center justify-center" aria-hidden="true">
        <span className="absolute inset-x-0 top-2 h-px bg-[var(--border-default)]" />
        <span className="absolute inset-x-3 bottom-2 h-px bg-[var(--border-default)]" />
        <span className="absolute left-4 top-0 h-full w-px bg-[var(--border-default)]" />
        <span className="absolute right-4 top-0 h-full w-px bg-[var(--border-default)]" />
        <span className="relative flex size-11 items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--surface)] text-[var(--text-tertiary)] shadow-xs">
          {icon}
        </span>
      </div>
      <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
      <p className="mt-1 max-w-md text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
