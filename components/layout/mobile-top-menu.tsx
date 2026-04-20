"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Globe2, Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  mobileNavOptions,
  readMobileNavKeys,
  type MobileNavItemKey
} from "@/lib/mobile-navigation";
import { useActiveClient } from "@/lib/client-context";
import { useClientPreferences } from "@/lib/repositories/use-client-preferences";

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
    <div className="fixed right-4 top-4 z-40 flex items-center gap-2 lg:hidden">
      <ThemeToggle compact />
      <div className="relative">
        <Button
          aria-expanded={open}
          aria-label="Open more pages"
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm"
          size="sm"
          type="button"
          variant="outline"
          onClick={() => setOpen((current) => !current)}
        >
          <span className="relative flex items-center justify-center">
            <Menu className="h-4 w-4" />
            <span className="sr-only">More pages</span>
            <span className="absolute -right-4 -top-3 rounded-full bg-muted px-1.5 py-0.5 text-[0.62rem] font-medium text-foreground">
              {hiddenPages.length}
            </span>
          </span>
        </Button>
        {open ? (
          <>
            <button
              aria-label="Close more pages menu"
              className="fixed inset-0 z-[68] bg-black/45"
              type="button"
              onClick={() => setOpen(false)}
            />
            <div className="fixed inset-x-3 top-16 z-[69] rounded-[1.5rem] border border-border bg-card p-3 shadow-[var(--surface-shadow)]">
              <div className="mb-2 flex items-center justify-between px-1">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Pages
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Open any page without changing your bottom navigation.
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
                      className={[
                        "flex min-h-14 items-start gap-3 rounded-[1rem] px-3 py-3 transition",
                        active
                          ? "bg-[rgba(189,156,87,0.16)] text-foreground"
                          : "bg-muted/40 text-foreground hover:bg-muted"
                      ].join(" ")}
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
