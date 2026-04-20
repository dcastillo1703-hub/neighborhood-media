import { ReactNode } from "react";

import { MobileNav } from "@/components/layout/mobile-nav";
import { MobileTopMenu } from "@/components/layout/mobile-top-menu";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="absolute inset-0 -z-10 bg-olive-glow opacity-70" />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-[linear-gradient(180deg,var(--shell-glow-top),transparent)]" />
      <div className="flex">
        <Sidebar />
        <main className="min-w-0 flex-1 px-3 py-3 pb-28 sm:px-4 sm:py-6 md:px-8 lg:min-h-screen lg:px-10 lg:pb-6 xl:px-14">
          <div className="hidden lg:block">
            <Topbar />
          </div>
          <MobileTopMenu />
          <MobileNav />
          <div className="pb-12">{children}</div>
        </main>
      </div>
    </div>
  );
}
