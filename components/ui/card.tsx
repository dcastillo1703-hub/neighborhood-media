import * as React from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.2rem] border p-4 text-card-foreground shadow-[var(--surface-shadow)] sm:p-5",
        "border-[color:var(--surface-border-strong)] bg-[color:var(--surface-elevated)]/95",
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
  return <h3 className={cn("font-display text-[1.1rem] leading-tight tracking-[-0.02em] text-foreground sm:text-[1.24rem]", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground", className)} {...props} />;
}
