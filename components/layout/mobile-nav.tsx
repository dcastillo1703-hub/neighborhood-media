"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navigation } from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:hidden">
      {navigation.map((item) => (
        <Link
          className={cn(
            "rounded-2xl border px-3 py-3 text-center text-sm transition",
            pathname === item.href
              ? "border-primary/40 bg-[linear-gradient(180deg,rgba(189,156,87,0.95),rgba(166,136,75,0.9))] text-primary-foreground"
              : "border-border bg-card/70 text-muted-foreground hover:border-primary/25 hover:bg-accent/30"
          )}
          href={item.href}
          key={item.href}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
