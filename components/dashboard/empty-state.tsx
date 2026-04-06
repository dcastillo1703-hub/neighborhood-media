import { ReactNode } from "react";
import { Inbox } from "lucide-react";

import { Card } from "@/components/ui/card";

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="border-dashed border-border/80 bg-card/70 py-10 text-center">
      <div className="mx-auto flex max-w-md flex-col items-center">
        <div className="rounded-full border border-primary/20 bg-primary/10 p-3 text-primary">
          <Inbox className="h-5 w-5" />
        </div>
        <h3 className="mt-4 font-display text-2xl text-foreground">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </Card>
  );
}
