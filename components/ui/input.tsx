import * as React from "react";

import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-xl border border-border bg-card/70 px-4 py-2 text-base text-foreground outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring sm:text-sm",
        className
      )}
      {...props}
    />
  );
}
