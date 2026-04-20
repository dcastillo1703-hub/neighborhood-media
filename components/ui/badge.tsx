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
        "inline-flex items-center rounded-full border border-primary/18 bg-[linear-gradient(180deg,rgba(189,156,87,0.14),rgba(189,156,87,0.06))] px-3.5 py-1.5 text-[0.66rem] uppercase tracking-[0.22em] text-primary",
        className
      )}
    >
      {children}
    </span>
  );
}
