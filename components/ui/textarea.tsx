import * as React from "react";

import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-28 w-full rounded-xl border border-border/80 bg-card/72 px-4 py-3 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] outline-none transition duration-200 placeholder:text-muted-foreground focus:border-primary/25 focus:ring-2 focus:ring-ring",
        className
      )}
      {...props}
    />
  );
}
