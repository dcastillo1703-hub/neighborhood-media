import * as React from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.25rem] border border-[rgba(146,124,73,0.14)] bg-[rgba(253,251,247,0.94)] p-4 text-card-foreground shadow-[0_10px_24px_rgba(91,72,42,0.05)] backdrop-blur sm:p-5",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative mb-4 flex items-start justify-between gap-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("font-display text-[1.15rem] leading-tight tracking-[-0.02em] text-foreground sm:text-[1.25rem]", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground", className)} {...props} />;
}
