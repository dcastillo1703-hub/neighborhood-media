import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string;
  detail: string;
  tone?: "gold" | "olive";
  className?: string;
  href?: string;
};

export function StatCard({ label, value, detail, tone = "gold", className, href }: StatCardProps) {
  const accentClass =
    tone === "olive"
      ? "border-[#7f8a57]/30 bg-[#7f8a57]/12 text-[#c8d0b0]"
      : "border-primary/25 bg-primary/10 text-primary";

  const content = (
    <Card
      className={cn(
        "h-full p-5 transition-transform duration-300 ease-out sm:p-6",
        href ? "cursor-pointer hover:-translate-y-0.5 hover:border-primary/35" : "hover:-translate-y-0.5",
        className
      )}
    >
      <CardHeader className="mb-4">
        <div>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="mt-4 text-[2rem] sm:text-[2.35rem]">{value}</CardTitle>
        </div>
        <div className={cn("rounded-full border p-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.18)]", accentClass)}>
          <ArrowUpRight className="h-4 w-4" />
        </div>
      </CardHeader>
      <p className="max-w-[18rem] text-sm leading-6 text-muted-foreground">{detail}</p>
    </Card>
  );

  if (!href) {
    return content;
  }

  return (
    <Link className="block h-full" href={href}>
      {content}
    </Link>
  );
}
