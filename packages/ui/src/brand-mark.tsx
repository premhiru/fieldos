import * as React from "react";

import { cn } from "./utils";

interface BrandMarkProps extends React.SVGAttributes<SVGSVGElement> {
  inverted?: boolean;
}

export function BrandMark({ className, inverted = false, ...props }: BrandMarkProps) {
  const gradientId = React.useId();

  return (
    <svg
      aria-hidden="true"
      className={cn("size-8", className)}
      fill="none"
      viewBox="0 0 32 32"
      {...props}
    >
      <defs>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={gradientId}
          x1="5"
          x2="27"
          y1="3"
          y2="29"
        >
          <stop stopColor={inverted ? "#ff9a61" : "#ff7a33"} />
          <stop offset="1" stopColor={inverted ? "#33e2c4" : "#0f9d86"} />
        </linearGradient>
      </defs>
      <rect fill={`url(#${gradientId})`} height="32" rx="7" width="32" />
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
          Caladrona
        </div>
        {!compact ? (
          <div
            className={cn(
              "text-xs leading-4",
              inverted ? "text-[#aeb4b9]" : "text-[var(--text-tertiary)]"
            )}
          >
            Operational intelligence
          </div>
        ) : null}
      </div>
    </div>
  );
}
