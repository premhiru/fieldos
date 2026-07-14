import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium leading-4 transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[var(--action-primary)] text-white",
        muted:
          "border-[var(--border-default)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]",
        success:
          "border-[var(--status-healthy-border)] bg-[var(--status-healthy-soft)] text-[var(--status-healthy-text)]",
        warning:
          "border-[var(--status-attention-border)] bg-[var(--status-attention-soft)] text-[var(--status-attention-text)]"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
