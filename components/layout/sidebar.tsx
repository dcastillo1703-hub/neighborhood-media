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
    <aside className="sticky top-0 hidden h-screen w-[18.5rem] flex-col border-r border-[rgba(132,108,65,0.14)] bg-[linear-gradient(180deg,rgba(247,242,234,0.98),rgba(240,232,219,0.96))] lg:flex">
      <div className="flex-1 overflow-y-auto px-6 py-7">
        <div className="space-y-10">
          <div>
            <p className="text-[0.68rem] uppercase tracking-[0.34em] text-[rgba(228,214,184,0.78)]">
              Neighborhood Media OS
            </p>
            <div className="mt-5 flex justify-center rounded-[1.5rem] border border-[rgba(146,124,73,0.12)] bg-[linear-gradient(180deg,rgba(255,252,247,0.96),rgba(245,237,226,0.92))] px-4 py-6 shadow-[0_16px_32px_rgba(124,97,48,0.08)]">
              <Image
                alt={`${activeClient.name} logo`}
                className="h-auto w-auto max-w-[210px] object-contain"
                height={88}
                priority
                src="/meama-logo.png"
                width={210}
              />
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Meama&apos;s operating system for campaigns, content, approvals, and restaurant growth.
            </p>
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {clients.length} active client workspace{clients.length === 1 ? "" : "s"}
            </p>
          </div>
          <div>
            <p className="mb-3 text-[0.68rem] uppercase tracking-[0.32em] text-muted-foreground">
              Workspace
            </p>
            <nav className="space-y-1.5">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;

              return (
                <Link
                  className={cn(
                    "group flex items-center gap-3 rounded-[1.2rem] px-4 py-3 text-sm transition",
                    active
                      ? "bg-[linear-gradient(180deg,rgba(205,174,111,0.96),rgba(181,150,90,0.92))] text-primary-foreground shadow-[0_14px_32px_rgba(140,109,47,0.12)]"
                      : "text-foreground/78 hover:bg-[rgba(189,156,87,0.08)] hover:text-foreground"
                  )}
                  href={item.href}
                  key={item.href}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full transition",
                      active
                        ? "bg-white/18"
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
