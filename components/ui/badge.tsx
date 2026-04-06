import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Badge({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-primary/20 bg-[linear-gradient(180deg,rgba(189,156,87,0.15),rgba(189,156,87,0.05))] px-3.5 py-1.5 text-[0.68rem] uppercase tracking-[0.24em] text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]",
        className
      )}
    >
      {children}
    </span>
  );
}
