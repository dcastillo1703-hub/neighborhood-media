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
        "rounded-[1rem] border border-[rgba(146,124,73,0.12)] bg-[rgba(252,249,244,0.86)] p-3.5 transition-colors duration-300 hover:border-[rgba(189,156,87,0.24)] hover:bg-[rgba(255,252,247,0.96)] sm:p-4",
        className
      )}
    >
      {children}
    </div>
  );
}
