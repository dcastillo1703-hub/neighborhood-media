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
        "rounded-[1.35rem] border border-[rgba(146,124,73,0.12)] bg-[linear-gradient(180deg,rgba(252,249,244,0.98),rgba(246,240,231,0.94))] p-4 shadow-[0_14px_28px_rgba(124,97,48,0.06)] transition-colors duration-300 hover:border-[rgba(189,156,87,0.2)] sm:p-5",
        className
      )}
    >
      {children}
    </div>
  );
}
