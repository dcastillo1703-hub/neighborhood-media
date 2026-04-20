import * as React from "react";

import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-xl border border-border/80 bg-card/72 px-4 py-2 text-base text-foreground outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-200 placeholder:text-muted-foreground focus:border-primary/25 focus:ring-2 focus:ring-ring sm:text-sm",
        className
      )}
      {...props}
    />
  );
}
