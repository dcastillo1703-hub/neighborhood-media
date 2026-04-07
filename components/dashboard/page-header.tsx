import { motion } from "framer-motion";
import { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "mb-8 flex flex-col gap-5 lg:mb-10 lg:flex-row lg:items-end lg:justify-between",
        className
      )}
    >
      <div className="max-w-3xl">
        {eyebrow ? <Badge>{eyebrow}</Badge> : null}
        <h1 className="mt-4 max-w-4xl font-display text-[2.45rem] leading-[0.98] tracking-[-0.03em] text-foreground sm:text-5xl lg:mt-5 lg:text-6xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-[1.02rem] sm:leading-8">
          {description}
        </p>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </motion.div>
  );
}
