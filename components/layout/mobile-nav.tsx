"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CheckCircle2, Home, Search, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

const mobileNavigation = [
  { href: "/", label: "Home", icon: Home },
  { href: "/content", label: "My tasks", icon: CheckCircle2 },
  { href: "/approvals", label: "Inbox", icon: Bell },
  { href: "/campaigns", label: "Projects", icon: Search },
  { href: "/settings", label: "Account", icon: UserRound }
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#202024]/95 px-2 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-1.5 text-white shadow-[0_-18px_45px_rgba(0,0,0,0.25)] backdrop-blur lg:hidden">
      <div className="grid grid-cols-5">
        {mobileNavigation.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-[0.66rem] font-medium transition",
                active ? "text-white" : "text-white/50"
              )}
              href={item.href}
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
