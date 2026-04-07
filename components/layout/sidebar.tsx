"use client";

import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CheckSquare,
  LayoutDashboard,
  PenSquare,
  ShieldCheck,
  Target,
  TrendingUp
} from "lucide-react";

import { useActiveClient } from "@/lib/client-context";
import { cn } from "@/lib/utils";

export const navigation: Array<{
  href: Route;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/campaigns", label: "Campaigns", icon: Target },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/content", label: "Content", icon: PenSquare },
  { href: "/approvals", label: "Approvals", icon: CheckSquare },
  { href: "/performance", label: "Performance", icon: TrendingUp },
  { href: "/settings", label: "Settings", icon: ShieldCheck }
];

export function Sidebar() {
  const pathname = usePathname();
  const { activeClient, clients } = useActiveClient();

  return (
    <aside className="sticky top-0 hidden h-screen w-[16rem] flex-col border-r border-[rgba(132,108,65,0.14)] bg-[rgba(247,242,234,0.94)] lg:flex">
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-7">
          <div>
            <p className="px-3 text-[0.66rem] uppercase tracking-[0.26em] text-muted-foreground">
              Meama OS
            </p>
            <div className="mt-3 flex justify-center rounded-[1rem] border border-[rgba(146,124,73,0.12)] bg-[rgba(255,252,247,0.8)] px-3 py-4">
              <Image
                alt={`${activeClient.name} logo`}
                className="h-auto w-auto max-w-[170px] object-contain"
                height={72}
                priority
                src="/meama-logo.png"
                width={170}
              />
            </div>
            <p className="mt-3 px-3 text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
              {clients.length} active client workspace{clients.length === 1 ? "" : "s"}
            </p>
          </div>
          <div>
            <p className="mb-2 px-3 text-[0.68rem] uppercase tracking-[0.24em] text-muted-foreground">
              Workspace
            </p>
            <nav className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;

              return (
                <Link
                  className={cn(
                    "group flex items-center gap-3 rounded-[1.2rem] px-4 py-3 text-sm transition",
                    active
                      ? "bg-[rgba(189,156,87,0.16)] text-foreground"
                      : "text-foreground/72 hover:bg-[rgba(189,156,87,0.08)] hover:text-foreground"
                  )}
                  href={item.href}
                  key={item.href}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full transition",
                      active
                        ? "bg-[rgba(189,156,87,0.18)] text-foreground"
                        : "bg-[rgba(189,156,87,0.08)] text-muted-foreground group-hover:bg-[rgba(189,156,87,0.14)] group-hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
            </nav>
          </div>
        </div>
      </div>

    </aside>
  );
}
