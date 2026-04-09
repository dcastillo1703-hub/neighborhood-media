"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BarChart3,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Home,
  LineChart,
  ListChecks,
  UserRound
} from "lucide-react";

import {
  mobileNavOptions,
  mobileNavUpdatedEvent,
  readMobileNavKeys,
  type MobileNavItemKey
} from "@/lib/mobile-navigation";
import { useActiveClient } from "@/lib/client-context";
import { useClientPreferences } from "@/lib/repositories/use-client-preferences";
import { cn } from "@/lib/utils";

const mobileNavIcons = {
  home: Home,
  content: CheckCircle2,
  approvals: Bell,
  campaigns: Briefcase,
  calendar: CalendarDays,
  performance: LineChart,
  "web-analytics": BarChart3,
  operations: ListChecks,
  settings: UserRound
} satisfies Record<MobileNavItemKey, typeof Home>;

export function MobileNav() {
  const pathname = usePathname();
  const { activeClient } = useActiveClient();
  useClientPreferences(activeClient.id);
  const [visibleNavKeys, setVisibleNavKeys] = useState<MobileNavItemKey[]>(() =>
    readMobileNavKeys()
  );
  const mobileNavigation = useMemo(
    () =>
      visibleNavKeys
        .map((key) => mobileNavOptions.find((option) => option.key === key))
        .filter((option): option is NonNullable<typeof option> => Boolean(option)),
    [visibleNavKeys]
  );

  useEffect(() => {
    const syncMobileNav = () => setVisibleNavKeys(readMobileNavKeys());
    window.addEventListener(mobileNavUpdatedEvent, syncMobileNav);
    window.addEventListener("storage", syncMobileNav);

    return () => {
      window.removeEventListener(mobileNavUpdatedEvent, syncMobileNav);
      window.removeEventListener("storage", syncMobileNav);
    };
  }, []);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#202024]/95 px-2 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-1.5 text-white shadow-[0_-18px_45px_rgba(0,0,0,0.25)] backdrop-blur lg:hidden">
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${mobileNavigation.length}, minmax(0, 1fr))` }}
      >
        {mobileNavigation.map((item) => {
          const Icon = mobileNavIcons[item.key];
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-[0.66rem] font-medium transition",
                active ? "text-white" : "text-white/50"
              )}
              href={item.href as never}
              key={item.href}
            >
              <Icon className={cn("h-6 w-6", active ? "stroke-[2.4]" : "stroke-[2]")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
