import type { ReactNode } from "react";

import { AuthGate } from "@/components/auth/auth-gate";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ClientProvider } from "@/lib/client-context";
import { WorkspaceProvider } from "@/lib/workspace-context";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <WorkspaceProvider>
        <ClientProvider>
          <DashboardShell>{children}</DashboardShell>
        </ClientProvider>
      </WorkspaceProvider>
    </AuthGate>
  );
}
