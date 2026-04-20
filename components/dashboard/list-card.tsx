import { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function ListCard({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[1rem] border p-3.5 transition duration-200 sm:p-4",
        "border-[color:var(--surface-border-soft)] bg-[color:var(--surface-soft)] hover:border-primary/22 hover:bg-card/90",
        className
      )}
    >
      {children}
    </div>
  );
}
