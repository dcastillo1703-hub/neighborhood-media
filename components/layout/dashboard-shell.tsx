import { ReactNode } from "react";

import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 -z-10 bg-olive-glow opacity-80" />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-[linear-gradient(180deg,rgba(185,151,83,0.08),transparent)]" />
      <div className="flex">
        <Sidebar />
        <main className="min-h-screen flex-1 px-3 py-4 pb-28 sm:px-4 sm:py-6 md:px-8 lg:px-10 lg:pb-6 xl:px-14">
          <div className="hidden lg:block">
            <Topbar />
          </div>
          <MobileNav />
          <div className="pb-12">{children}</div>
        </main>
      </div>
    </div>
  );
}
