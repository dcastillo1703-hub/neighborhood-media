"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronDown, Globe2, LayoutGrid, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  mobileNavOptions,
  readMobileNavKeys,
  type MobileNavItemKey
} from "@/lib/mobile-navigation";
import { useActiveClient } from "@/lib/client-context";
import { useClientPreferences } from "@/lib/repositories/use-client-preferences";
import { cn } from "@/lib/utils";

type ExtraMobilePage = {
  key: MobileNavItemKey | "web-analytics";
  href: string;
  label: string;
  description: string;
};

const extraMobilePages: ExtraMobilePage[] = [
  {
    key: "web-analytics",
    href: "/web-analytics",
    label: "Web Analytics",
    description: "Website traffic, sources, pages, and campaign handoff."
  }
];

export function MobileTopMenu() {
  const pathname = usePathname();
  const { activeClient } = useActiveClient();
  useClientPreferences(activeClient.id);
  const [open, setOpen] = useState(false);
  const visibleKeys = readMobileNavKeys();

  const hiddenPages = useMemo(() => {
    const configuredPages = mobileNavOptions.filter((option) => !visibleKeys.includes(option.key));
    const additionalPages = extraMobilePages.filter(
      (page) => page.key === "web-analytics" && !visibleKeys.includes("web-analytics")
    );
    return [...configuredPages, ...additionalPages];
  }, [visibleKeys]);

  if (!hiddenPages.length) {
    return null;
  }

  return (
    <div className="sticky top-2 z-40 mb-4 flex justify-end lg:hidden">
      <div className="relative">
        <Button
          className="rounded-full border border-border bg-card/90 px-4 text-sm text-foreground shadow-sm backdrop-blur"
          size="sm"
          type="button"
          variant="outline"
          onClick={() => setOpen((current) => !current)}
        >
          <LayoutGrid className="mr-2 h-4 w-4" />
          More pages
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
        {open ? (
          <div className="absolute right-0 top-12 w-[18rem] rounded-[1.4rem] border border-border bg-card/95 p-3 shadow-[0_20px_40px_rgba(0,0,0,0.18)] backdrop-blur">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Jump to
              </p>
              <button
                className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                type="button"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              {hiddenPages.map((page) => {
                const active =
                  pathname === page.href ||
                  (page.href !== "/" && pathname.startsWith(page.href));

                return (
                  <Link
                    key={page.key}
                    className={cn(
                      "flex items-start gap-3 rounded-2xl px-3 py-3 transition",
                      active
                        ? "bg-[rgba(189,156,87,0.16)] text-foreground"
                        : "bg-muted/40 text-foreground hover:bg-muted"
                    )}
                    href={page.href as never}
                    onClick={() => setOpen(false)}
                  >
                    <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-background/75 text-muted-foreground">
                      <Globe2 className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{page.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {page.description}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
