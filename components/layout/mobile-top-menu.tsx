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
    <div className="sticky top-2 z-40 mb-4 lg:hidden">
      <div className="relative">
        <Button
          aria-expanded={open}
          aria-label="Open more pages"
          className="flex h-12 w-full items-center justify-between rounded-[1.15rem] border border-border bg-card/95 px-4 text-left text-sm text-foreground shadow-sm backdrop-blur"
          size="default"
          type="button"
          variant="outline"
          onClick={() => setOpen((current) => !current)}
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <LayoutGrid className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">More pages</span>
              <span className="block truncate text-xs text-muted-foreground">
                Open pages that are not pinned in the bottom bar
              </span>
            </span>
          </span>
          <span className="ml-3 flex shrink-0 items-center gap-2 text-muted-foreground">
            <span className="rounded-full bg-muted px-2 py-1 text-[0.68rem] font-medium text-foreground">
              {hiddenPages.length}
            </span>
            <ChevronDown
              className={cn("h-4 w-4 transition", open ? "rotate-180" : "rotate-0")}
            />
          </span>
        </Button>
        {open ? (
          <>
            <button
              aria-label="Close more pages menu"
              className="fixed inset-0 z-[68] bg-black/20"
              type="button"
              onClick={() => setOpen(false)}
            />
            <div className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[69] rounded-[1.5rem] border border-border bg-card/98 p-3 shadow-[0_24px_60px_rgba(0,0,0,0.22)] backdrop-blur">
              <div className="mb-2 flex items-center justify-between px-1">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    More pages
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Jump without changing your bottom navigation.
                  </p>
                </div>
                <button
                  className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  type="button"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {hiddenPages.map((page) => {
                  const active =
                    pathname === page.href ||
                    (page.href !== "/" && pathname.startsWith(page.href));

                  return (
                    <Link
                      key={page.key}
                      className={cn(
                        "flex min-h-14 items-start gap-3 rounded-[1rem] px-3 py-3 transition",
                        active
                          ? "bg-[rgba(189,156,87,0.16)] text-foreground"
                          : "bg-muted/40 text-foreground hover:bg-muted"
                      )}
                      href={page.href as never}
                      onClick={() => setOpen(false)}
                    >
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background/75 text-muted-foreground">
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
          </>
        ) : null}
      </div>
    </div>
  );
}
