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
      {icon ? (
        <div className="mb-4 flex size-11 items-center justify-center rounded-md bg-slate-100 text-slate-500">
          {icon}
        </div>
      ) : null}
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-600">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
