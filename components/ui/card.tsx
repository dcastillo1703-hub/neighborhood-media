import * as React from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.75rem] border border-[rgba(146,124,73,0.14)] bg-[linear-gradient(180deg,rgba(253,251,247,0.98),rgba(247,242,235,0.96))] p-6 text-card-foreground shadow-ambient backdrop-blur before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top,rgba(189,156,87,0.06),transparent_34%)] before:opacity-100 after:pointer-events-none after:absolute after:inset-[1px] after:rounded-[calc(1.75rem-1px)] after:border after:border-white/70 after:content-['']",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative mb-5 flex items-start justify-between gap-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("font-display text-[1.35rem] leading-tight tracking-[-0.02em] text-foreground", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[0.72rem] uppercase tracking-[0.22em] text-muted-foreground", className)} {...props} />;
}
