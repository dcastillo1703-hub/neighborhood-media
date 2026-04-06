import { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function StatGrid({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-4", className)} {...props}>
      {children}
    </div>
  );
}
