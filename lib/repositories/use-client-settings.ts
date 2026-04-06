"use client";

import { useMemo } from "react";

import { meamaSettings, seededClientSettings } from "@/data/seed";
import { useScopedEntity } from "@/lib/repositories/client-store";
import { clientSettingsAdapter } from "@/lib/repositories/supabase-store";
import { ClientSettings, RevenueModelInput } from "@/types";

export function toRevenueModelInput(settings: ClientSettings): RevenueModelInput {
  return {
    mode: "monthly",
    averageCheck: settings.averageCheck,
    monthlyCovers: settings.monthlyCovers,
    weeklyCovers: settings.weeklyCovers,
    daysOpenPerWeek: settings.daysOpenPerWeek,
    weeksPerMonth: settings.weeksPerMonth,
    guestsPerTable: settings.guestsPerTable,
    growthTarget: settings.defaultGrowthTarget
  };
}

export function useClientSettings(clientId: string) {
  const seed =
    seededClientSettings.find((settings) => settings.clientId === clientId) ?? meamaSettings;
  const [settings, setSettings, ready] = useScopedEntity<ClientSettings>(
    "nmos-client-settings",
    clientId,
    seed,
    clientSettingsAdapter
  );
  const revenueModelDefaults = useMemo(() => toRevenueModelInput(settings), [settings]);

  return {
    settings,
    setSettings,
    ready,
    revenueModelDefaults
  };
}
