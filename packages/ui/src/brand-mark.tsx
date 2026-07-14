import * as React from "react";

import { cn } from "./utils";

interface BrandMarkProps extends React.SVGAttributes<SVGSVGElement> {
  inverted?: boolean;
}

export function BrandMark({ className, inverted = false, ...props }: BrandMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={cn("size-8", className)}
      fill="none"
      viewBox="0 0 32 32"
      {...props}
    >
      <rect
        className={inverted ? "fill-white" : "fill-[var(--brand-mark)]"}
        width="32"
        height="32"
        rx="6"
      />
      <path
        className={inverted ? "fill-[var(--brand-mark)]" : "fill-white"}
        d="M8 8h15.5v4H12v3.25h9v4h-9V24H8V8Z"
      />
      <rect className="fill-[var(--status-healthy)]" height="4" rx="1" width="4" x="21" y="20" />
    </svg>
  );
}

interface BrandLockupProps extends React.HTMLAttributes<HTMLDivElement> {
  compact?: boolean;
  inverted?: boolean;
}

export function BrandLockup({
  className,
  compact = false,
  inverted = false,
  ...props
}: BrandLockupProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)} {...props}>
      <BrandMark className={compact ? "size-8" : "size-9"} inverted={inverted} />
      <div className="min-w-0">
        <div
          className={cn(
            "text-[15px] font-semibold leading-5",
            inverted ? "text-white" : "text-[var(--text-primary)]"
          )}
        >
          FieldOS
        </div>
        {!compact ? (
          <div
            className={cn(
              "text-xs leading-4",
              inverted ? "text-[#aeb4b9]" : "text-[var(--text-tertiary)]"
            )}
          >
            Field operations
          </div>
        ) : null}
      </div>
    </div>
  );
}
