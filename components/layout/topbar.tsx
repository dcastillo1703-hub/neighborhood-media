"use client";

import { Bell, LogOut, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/lib/auth-context";
import { useActiveClient } from "@/lib/client-context";

export function Topbar() {
  const { activeClient, clients, setActiveClientId } = useActiveClient();
  const { mode, profile, signOut } = useAuth();
  const operatorName = profile?.fullName ?? profile?.email?.split("@")[0] ?? "Operator";

  return (
    <div className="mb-8 flex flex-col gap-4 lg:mb-10 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <h2 className="font-display text-[2.15rem] leading-none tracking-[-0.03em] text-foreground sm:text-4xl lg:text-[2.85rem]">
          Welcome back, {operatorName}
        </h2>
        <div className="mt-4 lg:hidden">
          <select
            className="h-11 w-full rounded-2xl border border-border bg-card/70 px-4 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
            value={activeClient.id}
            onChange={(event) => setActiveClientId(event.target.value)}
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name} · {client.status}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="hidden h-11 rounded-full border border-border bg-card/70 px-4 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] lg:block"
          value={activeClient.id}
          onChange={(event) => setActiveClientId(event.target.value)}
        >
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name} · {client.status}
            </option>
          ))}
        </select>
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input className="w-64 rounded-full pl-9 lg:w-72" placeholder="Search this client's tasks, campaigns, and scheduled posts" />
        </div>
        {mode === "supabase" ? (
          <div className="hidden rounded-full border border-border bg-card/65 px-4 py-2 text-xs uppercase tracking-[0.16em] text-muted-foreground xl:block">
            {profile?.email ?? "Authenticated"}
          </div>
        ) : null}
        <ThemeToggle />
        {mode === "supabase" ? (
          <Button size="sm" variant="ghost" onClick={() => void signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        ) : null}
        <button className="rounded-full border border-border bg-card/65 p-3 text-muted-foreground transition hover:border-primary/30 hover:text-foreground">
          <Bell className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
