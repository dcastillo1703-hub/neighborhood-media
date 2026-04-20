"use client";

import { useEffect, useState } from "react";

import { ListCard } from "@/components/dashboard/list-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useActiveClient } from "@/lib/client-context";
import { useIntegrations } from "@/lib/repositories/use-integrations";
import { appAccents, useTheme } from "@/lib/theme-context";
import { useGoogleAnalytics } from "@/lib/use-google-analytics";
import { useMetaBusinessSuite } from "@/lib/use-meta-business-suite";
import {
  defaultMobileNavItemKeys,
  maxMobileNavItems,
  mobileNavOptions,
  type MobileNavItemKey
} from "@/lib/mobile-navigation";
import { useClientPreferences } from "@/lib/repositories/use-client-preferences";
import {
  computeNextSyncRun,
  syncScheduleOptions,
  type SyncScheduleOption
} from "@/lib/integrations/schedule";
import { number } from "@/lib/utils";

type MetaConnectionNotice = {
  tone: "success" | "error";
  title: string;
  detail: string;
};

export default function SettingsPage() {
  const { activeClient } = useActiveClient();
  const { accent, accentKey, setAccentKey, mode, setMode } = useTheme();
  const {
    syncJobs,
    updateSyncJob,
    runSyncJob
  } = useIntegrations(activeClient.id);
  const {
    summary: metaSummary,
    ready: metaReady,
    error: metaError,
    beginConnection,
    selectAsset,
    syncInsights
  } = useMetaBusinessSuite(activeClient.id);
  const {
    summary: googleAnalyticsSummary,
    ready: googleAnalyticsReady,
    error: googleAnalyticsError,
    sync: syncGoogleAnalytics
  } = useGoogleAnalytics(activeClient.id);
  const {
    preferences,
    error: preferencesError,
    savePreferences
  } = useClientPreferences(activeClient.id);
  const [connectingProvider, setConnectingProvider] = useState<"facebook" | "instagram" | null>(
    null
  );
  const [syncingProvider, setSyncingProvider] = useState<"facebook" | "instagram" | null>(null);
  const [selectingAsset, setSelectingAsset] = useState<string | null>(null);
  const [mobileNavKeys, setMobileNavKeys] = useState<MobileNavItemKey[]>(defaultMobileNavItemKeys);
  const [metaActionError, setMetaActionError] = useState<string | null>(null);
  const [metaNotice, setMetaNotice] = useState<MetaConnectionNotice | null>(null);
  const [syncingGoogleAnalytics, setSyncingGoogleAnalytics] = useState(false);
  const [googleAnalyticsNotice, setGoogleAnalyticsNotice] = useState<MetaConnectionNotice | null>(
    null
  );

  const formatSyncTimestamp = (value?: string | null) => {
    if (!value) {
      return "Not scheduled yet";
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "numeric",
      day: "numeric",
      year: "2-digit",
      hour: "numeric",
      minute: "2-digit"
    }).format(parsed);
  };

  const googleAnalyticsSyncJob = syncJobs.find(
    (job) => job.provider === "google-analytics" && job.jobType === "sync-insights"
  );

  useEffect(() => {
    setMobileNavKeys(preferences.mobileNavKeys as MobileNavItemKey[]);
  }, [preferences.mobileNavKeys]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const metaStatus = params.get("meta");
    const provider = params.get("provider");
    const reason = params.get("reason");

    if (metaStatus === "connected") {
      setMetaNotice({
        tone: "success",
        title: "Meta login completed",
        detail: provider
          ? `${provider} returned successfully. Choose the correct connected account if multiple options appear.`
          : "Meta returned successfully. Choose the correct connected account if multiple options appear."
      });
      return;
    }

    if (metaStatus === "error") {
      setMetaNotice({
        tone: "error",
        title: "Meta login needs attention",
        detail: reason
          ? reason
          : "Meta returned an error. Check the configured app domains, redirect URI, and account permissions."
      });
    }
  }, []);

  const updateMobileNavKeys = (nextKeys: MobileNavItemKey[]) => {
    setMobileNavKeys(nextKeys);
    savePreferences({
      ...preferences,
      mobileNavKeys: nextKeys
    });
  };

  const toggleMobileNavKey = (key: MobileNavItemKey) => {
    if (mobileNavKeys.includes(key)) {
      updateMobileNavKeys(mobileNavKeys.filter((item) => item !== key));
      return;
    }

    if (mobileNavKeys.length >= maxMobileNavItems) {
      return;
    }

    updateMobileNavKeys([...mobileNavKeys, key]);
  };

  const moveMobileNavKey = (key: MobileNavItemKey, direction: "up" | "down") => {
    const currentIndex = mobileNavKeys.indexOf(key);

    if (currentIndex === -1) {
      return;
    }

    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (nextIndex < 0 || nextIndex >= mobileNavKeys.length) {
      return;
    }

    const nextKeys = [...mobileNavKeys];
    [nextKeys[currentIndex], nextKeys[nextIndex]] = [nextKeys[nextIndex], nextKeys[currentIndex]];
    updateMobileNavKeys(nextKeys);
  };

  const resetMobileNav = () => {
    updateMobileNavKeys(defaultMobileNavItemKeys);
  };

  const prepareMetaConnection = async (provider: "facebook" | "instagram") => {
    setConnectingProvider(provider);
    setMetaActionError(null);

    try {
      await beginConnection(provider);
    } catch (error) {
      setMetaActionError(
        error instanceof Error ? error.message : "Failed to prepare Meta connection."
      );
    } finally {
      setConnectingProvider(null);
    }
  };

  const chooseMetaAsset = async (
    provider: "facebook" | "instagram",
    assetId: string
  ) => {
    setSelectingAsset(`${provider}-${assetId}`);
    setMetaActionError(null);

    try {
      await selectAsset(provider, assetId);
    } catch (error) {
      setMetaActionError(
        error instanceof Error ? error.message : "Failed to select Meta account."
      );
    } finally {
      setSelectingAsset(null);
    }
  };

  const syncMetaProviderInsights = async (provider: "facebook" | "instagram") => {
    setSyncingProvider(provider);
    setMetaActionError(null);

    try {
      const payload = await syncInsights(provider);
      setMetaNotice({
        tone: "success",
        title: `${provider === "facebook" ? "Facebook" : "Instagram"} sync completed`,
        detail: payload.sync.topPost
          ? `Synced ${payload.sync.pageName}. Impressions: ${number(payload.sync.snapshot.impressions)}, clicks: ${number(payload.sync.snapshot.clicks)}, engagement: ${number(payload.sync.snapshot.conversions)}. Top content: ${payload.sync.topPost}`
          : `Synced ${payload.sync.pageName}. Impressions: ${number(payload.sync.snapshot.impressions)}, clicks: ${number(payload.sync.snapshot.clicks)}, engagement: ${number(payload.sync.snapshot.conversions)}. Accessible posts: ${number(payload.sync.postCount)}.`
      });
    } catch (error) {
      setMetaActionError(
        error instanceof Error ? error.message : "Failed to sync Meta insights."
      );
    } finally {
      setSyncingProvider(null);
    }
  };

  const runGoogleAnalyticsSync = async () => {
    setSyncingGoogleAnalytics(true);
    setGoogleAnalyticsNotice(null);

    try {
      const payload = await syncGoogleAnalytics();
      setGoogleAnalyticsNotice({
        tone: "success",
        title: "Google Analytics sync completed",
        detail: `Synced property ${payload.sync.propertyId}. Sessions: ${number(payload.summary.sessions)}, users: ${number(payload.summary.users)}, views: ${number(payload.summary.views)}.`
      });
    } catch (error) {
      setGoogleAnalyticsNotice({
        tone: "error",
        title: "Google Analytics needs attention",
        detail:
          error instanceof Error ? error.message : "Failed to sync Google Analytics."
      });
    } finally {
      setSyncingGoogleAnalytics(false);
    }
  };

  const updateGoogleAnalyticsSchedule = async (schedule: SyncScheduleOption) => {
    if (!googleAnalyticsSyncJob) {
      return;
    }

    await updateSyncJob(googleAnalyticsSyncJob.id, {
      ...googleAnalyticsSyncJob,
      schedule,
      status: googleAnalyticsSummary?.readyToSync ? "Ready" : "Blocked",
      nextRunAt: computeNextSyncRun(schedule),
      detail: `Scheduled to run ${schedule.toLowerCase()}.`
    });

    setGoogleAnalyticsNotice({
      tone: "success",
      title: "Google Analytics schedule updated",
      detail: `The website analytics sync will now run ${schedule.toLowerCase()}.`
    });
  };

  const runScheduledGoogleAnalyticsJob = async () => {
    if (!googleAnalyticsSyncJob) {
      return;
    }

    setSyncingGoogleAnalytics(true);
    setGoogleAnalyticsNotice(null);

    try {
      const payload = await runSyncJob(googleAnalyticsSyncJob.id);
      setGoogleAnalyticsNotice({
        tone: "success",
        title: "Scheduled GA sync completed",
        detail: payload.job.detail
      });
    } catch (error) {
      setGoogleAnalyticsNotice({
        tone: "error",
        title: "Scheduled GA sync needs attention",
        detail: error instanceof Error ? error.message : "Unable to run scheduled GA sync."
      });
    } finally {
      setSyncingGoogleAnalytics(false);
    }
  };

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Settings"
        title="Manage the parts of the workspace that actually run"
        description="Only live, trustworthy controls stay here: appearance, mobile navigation, website analytics, and Meta."
      />

      <Card id="account-appearance">
        <CardHeader>
          <div>
            <CardDescription>Account Appearance</CardDescription>
            <CardTitle className="mt-3">Customize the workspace look and feel</CardTitle>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Accent and theme both update the shared app variables, so navigation, cards, buttons, and reporting surfaces stay visually consistent everywhere.
            </p>
          </div>
        </CardHeader>
        <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-[1.75rem] border border-border bg-card/65 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-foreground">Current appearance</p>
              <div className="inline-flex rounded-full border border-border bg-card/75 p-1">
                {(["light", "dark"] as const).map((themeOption) => (
                  <button
                    className={[
                      "rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition",
                      mode === themeOption ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent/30"
                    ].join(" ")}
                    key={themeOption}
                    type="button"
                    onClick={() => setMode(themeOption)}
                  >
                    {themeOption}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-border">
              <div className="px-5 py-6" style={{ backgroundColor: accent.bg, color: accent.text }}>
                <p className="text-xs uppercase tracking-[0.18em] opacity-70">Preview</p>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{accent.label} {mode} workspace</p>
              </div>
              <div className={mode === "dark" ? "space-y-3 bg-[#171b22] p-5 text-white" : "space-y-3 bg-[#202024] p-5 text-white"}>
                <div className="rounded-2xl bg-white/5 px-4 py-3">
                  Campaign controls use this accent.
                </div>
                <div className="flex gap-2">
                  <span className="rounded-full px-3 py-1 text-xs" style={{ backgroundColor: accent.soft, color: accent.bg }}>
                    Status
                  </span>
                  <span className="rounded-full px-3 py-1 text-xs" style={{ backgroundColor: accent.bg, color: accent.text }}>
                    Action
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {appAccents.map((option) => {
              const selected = option.key === accentKey;

              return (
                <button
                  className={[
                    "rounded-[1.5rem] border p-4 text-left transition",
                    selected
                      ? "border-primary/50 bg-primary/10 shadow-[0_16px_40px_rgba(149,114,46,0.12)]"
                      : "border-border bg-card/70 hover:border-primary/25 hover:bg-accent/25"
                  ].join(" ")}
                  key={option.key}
                  type="button"
                  onClick={() => setAccentKey(option.key)}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className="h-9 w-9 rounded-full border border-black/10"
                      style={{ backgroundColor: option.bg }}
                    />
                    <span>
                      <span className="block text-sm font-medium text-foreground">{option.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <Card id="mobile-navigation">
        <CardHeader>
          <div>
            <CardDescription>Mobile Navigation</CardDescription>
            <CardTitle className="mt-3">Choose what appears at the bottom</CardTitle>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Pick up to {maxMobileNavItems} destinations for the mobile bottom bar. The order here becomes the order on your phone.
            </p>
            {preferencesError ? (
              <p className="mt-2 text-sm text-primary">{preferencesError}</p>
            ) : null}
          </div>
          <Button size="sm" type="button" variant="outline" onClick={resetMobileNav}>
            Reset
          </Button>
        </CardHeader>
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-[1.5rem] border border-border bg-muted/25 p-4">
            <p className="text-sm font-medium text-foreground">Current mobile bar</p>
            <div className="mt-4 rounded-[1.25rem] border border-white/10 bg-[#202024] p-3 text-white">
              <div
                className="grid gap-1"
                style={{ gridTemplateColumns: `repeat(${mobileNavKeys.length || 1}, minmax(0, 1fr))` }}
              >
                {mobileNavKeys.map((key) => {
                  const option = mobileNavOptions.find((item) => item.key === key);

                  return option ? (
                    <div
                      className="rounded-xl bg-white/[0.04] px-1 py-2 text-center text-[0.66rem] text-white/80"
                      key={key}
                    >
                      {option.label}
                    </div>
                  ) : null;
                })}
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              If you remove `Account`, you can still reach Settings from desktop or by re-enabling it here later.
            </p>
          </div>
          <div className="grid gap-3">
            {mobileNavOptions.map((option) => {
              const selected = mobileNavKeys.includes(option.key);
              const selectedIndex = mobileNavKeys.indexOf(option.key);
              const disabled = !selected && mobileNavKeys.length >= maxMobileNavItems;

              return (
                <div
                  className={[
                    "grid gap-3 rounded-[1.25rem] border p-4 transition sm:grid-cols-[1fr_auto] sm:items-center",
                    selected
                      ? "border-primary/35 bg-primary/10"
                      : "border-border bg-card/70",
                    disabled ? "opacity-55" : ""
                  ].join(" ")}
                  key={option.key}
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <button
                        aria-pressed={selected}
                        className={[
                          "relative h-6 w-11 rounded-full transition",
                          selected ? "bg-primary" : "bg-muted-foreground/25"
                        ].join(" ")}
                        disabled={disabled}
                        type="button"
                        onClick={() => toggleMobileNavKey(option.key)}
                      >
                        <span
                          className={[
                            "absolute top-1 h-4 w-4 rounded-full bg-white transition",
                            selected ? "left-6" : "left-1"
                          ].join(" ")}
                        />
                      </button>
                      <div>
                        <p className="text-sm font-medium text-foreground">{option.label}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{option.description}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 sm:justify-end">
                    <Button
                      disabled={!selected || selectedIndex === 0}
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => moveMobileNavKey(option.key, "up")}
                    >
                      Up
                    </Button>
                    <Button
                      disabled={!selected || selectedIndex === mobileNavKeys.length - 1}
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => moveMobileNavKey(option.key, "down")}
                    >
                      Down
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card id="google-analytics">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardDescription>Google Analytics</CardDescription>
                <CardTitle className="mt-3">Website traffic connection</CardTitle>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Pull your website sessions, users, landing pages, and top traffic sources into the app so Performance can connect web activity back to campaigns.
                </p>
              </div>
              <Button
                disabled={!googleAnalyticsSummary?.readyToSync || syncingGoogleAnalytics}
                onClick={() => void runGoogleAnalyticsSync()}
                size="sm"
                variant="outline"
              >
                {syncingGoogleAnalytics ? "Syncing GA4..." : "Sync Google Analytics"}
              </Button>
            </div>
          </CardHeader>
          {!googleAnalyticsReady ? (
            <p className="text-sm text-muted-foreground">Loading Google Analytics setup...</p>
          ) : googleAnalyticsError || !googleAnalyticsSummary ? (
            <p className="text-sm text-primary">
              {googleAnalyticsError ?? "Unable to load Google Analytics setup."}
            </p>
          ) : (
            <div className="space-y-4">
              {googleAnalyticsNotice ? (
                <div
                  className={[
                    "rounded-[1.25rem] border p-4 text-sm",
                    googleAnalyticsNotice.tone === "success"
                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                      : "border-primary/30 bg-primary/10 text-primary"
                  ].join(" ")}
                >
                  <p className="font-medium">{googleAnalyticsNotice.title}</p>
                  <p className="mt-1 leading-6 opacity-85">{googleAnalyticsNotice.detail}</p>
                </div>
              ) : null}
              <ListCard>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-medium text-foreground">
                      {googleAnalyticsSummary.readyToSync
                        ? "Google Analytics is ready"
                        : "Google Analytics still needs configuration"}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {googleAnalyticsSummary.nextAction}
                    </p>
                    {googleAnalyticsSummary.propertyId ? (
                      <p className="mt-3 break-all text-xs text-muted-foreground">
                        Property ID:{" "}
                        <span className="text-foreground">{googleAnalyticsSummary.propertyId}</span>
                      </p>
                    ) : null}
                  </div>
                  <div className="grid min-w-48 gap-2">
                    {googleAnalyticsSummary.checks.map((check) => (
                      <div
                        className="flex items-center justify-between gap-3 rounded-full border border-border bg-card/70 px-3 py-2 text-xs"
                        key={check.key}
                      >
                        <span className="font-medium text-foreground">{check.label}</span>
                        <span
                          className={check.ready ? "text-emerald-600 dark:text-emerald-300" : "text-primary"}
                        >
                          {check.ready ? "Ready" : "Missing"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </ListCard>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ListCard>
                  <p className="text-sm text-muted-foreground">Sessions</p>
                  <p className="mt-2 text-2xl font-medium text-foreground">{number(googleAnalyticsSummary.sessions)}</p>
                </ListCard>
                <ListCard>
                  <p className="text-sm text-muted-foreground">Users</p>
                  <p className="mt-2 text-2xl font-medium text-foreground">{number(googleAnalyticsSummary.users)}</p>
                </ListCard>
                <ListCard>
                  <p className="text-sm text-muted-foreground">Views</p>
                  <p className="mt-2 text-2xl font-medium text-foreground">{number(googleAnalyticsSummary.views)}</p>
                </ListCard>
                <ListCard>
                  <p className="text-sm text-muted-foreground">Events</p>
                  <p className="mt-2 text-2xl font-medium text-foreground">{number(googleAnalyticsSummary.events)}</p>
                </ListCard>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <ListCard>
                  <p className="font-medium text-foreground">Top traffic sources</p>
                  <div className="mt-3 space-y-2">
                    {googleAnalyticsSummary.topSources.length ? (
                      googleAnalyticsSummary.topSources.map((source) => (
                        <div className="flex items-center justify-between gap-4 text-sm" key={source.label}>
                          <span className="text-muted-foreground">{source.label}</span>
                          <span className="text-foreground">{number(source.sessions)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Run the first sync to see where your traffic is coming from.</p>
                    )}
                  </div>
                </ListCard>
                <ListCard>
                  <p className="font-medium text-foreground">Top landing pages</p>
                  <div className="mt-3 space-y-2">
                    {googleAnalyticsSummary.topPages.length ? (
                      googleAnalyticsSummary.topPages.map((page) => (
                        <div className="flex items-center justify-between gap-4 text-sm" key={page.path}>
                          <span className="truncate text-muted-foreground">{page.path}</span>
                          <span className="shrink-0 text-foreground">{number(page.views)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Run the first sync to see which pages are doing the work.</p>
                    )}
                  </div>
                </ListCard>
              </div>
              <ListCard>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-medium text-foreground">Scheduled sync</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Keep GA4 fresh without constant browser refreshes. The app will also run the sync automatically when it is due and someone opens a relevant page.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        Next run:{" "}
                        <span className="text-foreground">
                          {formatSyncTimestamp(googleAnalyticsSummary.syncJob?.nextRunAt)}
                        </span>
                      </span>
                      {googleAnalyticsSummary.syncJob?.lastRunAt ? (
                        <span>
                          Last run:{" "}
                          <span className="text-foreground">
                            {formatSyncTimestamp(googleAnalyticsSummary.syncJob.lastRunAt)}
                          </span>
                        </span>
                      ) : null}
                      {googleAnalyticsSummary.syncJob ? (
                        <span
                          className={[
                            "rounded-full px-2.5 py-1 font-medium uppercase tracking-[0.14em]",
                            googleAnalyticsSummary.syncJob.due
                              ? "bg-primary/10 text-primary"
                              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          ].join(" ")}
                        >
                          {googleAnalyticsSummary.syncJob.due ? "Due now" : "On schedule"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid gap-3 lg:min-w-[15rem]">
                    <select
                      className="h-11 rounded-2xl border border-border bg-card/70 px-4 text-sm text-foreground"
                      value={googleAnalyticsSyncJob?.schedule ?? "Every 6 hours"}
                      onChange={(event) =>
                        void updateGoogleAnalyticsSchedule(event.target.value as SyncScheduleOption)
                      }
                    >
                      {syncScheduleOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <Button
                      disabled={!googleAnalyticsSummary.readyToSync || syncingGoogleAnalytics}
                      size="sm"
                      variant="outline"
                      onClick={() => void runScheduledGoogleAnalyticsJob()}
                    >
                      {syncingGoogleAnalytics ? "Running..." : "Run scheduled sync now"}
                    </Button>
                  </div>
                </div>
              </ListCard>
            </div>
          )}
        </Card>

        <Card id="meta-business-suite">
          <CardHeader>
            <div>
              <CardDescription>Meta Business Suite</CardDescription>
              <CardTitle className="mt-3">Facebook and Instagram connection</CardTitle>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Keep this section focused on what is truly connected, what is syncing, what data is available, and what is still missing.
              </p>
            </div>
          </CardHeader>
          {!metaReady ? (
            <p className="text-sm text-muted-foreground">Loading Meta setup...</p>
          ) : metaError || !metaSummary ? (
            <p className="text-sm text-primary">{metaError ?? "Unable to load Meta setup."}</p>
          ) : (
            <div className="space-y-4">
              {metaNotice ? (
                <div
                  className={[
                    "rounded-[1.25rem] border p-4 text-sm",
                    metaNotice.tone === "success"
                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                      : "border-primary/30 bg-primary/10 text-primary"
                  ].join(" ")}
                >
                  <p className="font-medium">{metaNotice.title}</p>
                  <p className="mt-1 leading-6 opacity-85">{metaNotice.detail}</p>
                </div>
              ) : null}
              {metaActionError ? (
                <div className="rounded-[1.25rem] border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
                  <p className="font-medium">Meta setup error</p>
                  <p className="mt-1 leading-6">{metaActionError}</p>
                </div>
              ) : null}
              <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
                <ListCard>
                  <p className="text-sm font-medium text-foreground">Connected</p>
                  <p className="mt-2 text-2xl text-foreground">{number(metaSummary.connectedChannels)}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {metaSummary.channels
                      .filter((channel) => channel.authStatus === "connected")
                      .map((channel) => `${channel.provider}: ${channel.connectedAssetLabel ?? channel.accountLabel}`)
                      .join(" · ") || "No Meta channel is connected yet."}
                  </p>
                </ListCard>
                <ListCard>
                  <p className="text-sm font-medium text-foreground">Syncing</p>
                  <p className="mt-2 text-2xl text-foreground">{number(metaSummary.totalQueuedPublishJobs)}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {metaSummary.totalQueuedPublishJobs
                      ? `${metaSummary.totalQueuedPublishJobs} publish job${metaSummary.totalQueuedPublishJobs === 1 ? "" : "s"} are still in motion.`
                      : "No Meta publish jobs are waiting right now."}
                  </p>
                </ListCard>
                <ListCard>
                  <p className="text-sm font-medium text-foreground">Available Data</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Facebook currently contributes impressions, clicks, engagement, attributed covers, and revenue into Performance and the campaign pipeline.
                  </p>
                </ListCard>
                <ListCard>
                  <p className="text-sm font-medium text-foreground">Missing Data</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {!metaSummary.readyToConnect
                      ? metaSummary.configStatus.nextAction
                      : metaSummary.channels.some((channel) => channel.provider === "instagram" && channel.authStatus !== "connected")
                        ? "Instagram is still optional and not connected yet, so only Facebook is driving live Meta data."
                        : "No major Meta setup gaps right now."}
                  </p>
                </ListCard>
              </div>
              <ListCard>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-medium text-foreground">
                      {metaSummary.readyToConnect
                        ? "Meta app is ready"
                        : "Meta app still needs configuration"}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {metaSummary.configStatus.nextAction}
                    </p>
                    {metaSummary.configStatus.redirectUri ? (
                      <p className="mt-3 break-all text-xs text-muted-foreground">
                        Redirect URI: <span className="text-foreground">{metaSummary.configStatus.redirectUri}</span>
                      </p>
                    ) : null}
                  </div>
                  <div className="grid min-w-48 gap-2">
                    {metaSummary.configStatus.checks.map((check) => (
                      <div
                        className="flex items-center justify-between gap-3 rounded-full border border-border bg-card/70 px-3 py-2 text-xs"
                        key={check.key}
                      >
                        <span className="font-medium text-foreground">{check.label}</span>
                        <span
                          className={check.ready ? "text-emerald-600 dark:text-emerald-300" : "text-primary"}
                        >
                          {check.ready ? "Ready" : "Missing"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </ListCard>
              {metaSummary.channels.map((channel) => (
                <ListCard key={channel.provider}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium capitalize text-foreground">{channel.provider}</p>
                        {channel.provider === "facebook" ? (
                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[0.62rem] font-medium uppercase tracking-[0.14em] text-primary">
                            Start here
                          </span>
                        ) : null}
                      </div>
                    <p className="mt-1 text-sm text-muted-foreground">{channel.accountLabel}</p>
                  </div>
                  <p className="text-xs uppercase tracking-[0.16em] text-primary">
                    {channel.authStatus}
                  </p>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <p className="text-sm text-muted-foreground">
                      Connected: <span className="text-foreground">{channel.connectedAssetLabel ?? "No account selected yet"}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Syncing: <span className="text-foreground">{channel.lastSyncAt ? `Last sync ${formatSyncTimestamp(channel.lastSyncAt)}` : "Not synced yet"}</span>
                    </p>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    <div className="rounded-2xl border border-border/70 bg-muted/25 p-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Available data</p>
                      <p className="mt-2 text-sm leading-6 text-foreground">
                        {channel.impressions
                          ? `${number(channel.impressions)} impressions, ${number(channel.clicks)} clicks, ${number(channel.conversions)} engagement`
                          : "No synced Meta metrics yet."}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/25 p-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Used in product</p>
                      <p className="mt-2 text-sm leading-6 text-foreground">
                        {channel.provider === "facebook"
                          ? "Performance, campaign pipeline, and Meta reporting use this Facebook data."
                          : "Instagram will join the same reporting flow once the account is connected."}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/25 p-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Missing data</p>
                      <p className="mt-2 text-sm leading-6 text-foreground">
                        {channel.provider === "facebook"
                          ? channel.nextAction ?? "Nothing major missing."
                          : channel.authStatus === "connected"
                            ? channel.nextAction ?? "Nothing major missing."
                            : "Instagram is not connected yet, so live Instagram insights and publishing are unavailable."}
                      </p>
                    </div>
                  </div>
                  {channel.availableAssets?.length ? (
                    <div className="mt-4 rounded-2xl border border-border/70 bg-card/65 p-4">
                      <p className="text-sm font-medium text-foreground">Choose connected account</p>
                      <div className="mt-3 space-y-2">
                        {channel.availableAssets.map((asset) => {
                          const selected = asset.id === channel.externalAccountId;

                          return (
                            <div
                              className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between"
                              key={asset.id}
                            >
                              <div>
                                <p className="font-medium text-foreground">{asset.label}</p>
                                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                  {asset.type}
                                </p>
                              </div>
                              <Button
                                disabled={selected || selectingAsset === `${channel.provider}-${asset.id}`}
                                onClick={() => void chooseMetaAsset(channel.provider, asset.id)}
                                size="sm"
                                variant={selected ? "default" : "outline"}
                              >
                                {selected
                                  ? "Selected"
                                  : selectingAsset === `${channel.provider}-${asset.id}`
                                    ? "Selecting..."
                                    : "Use this account"}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      disabled={!metaSummary.readyToConnect || connectingProvider === channel.provider}
                      onClick={() => void prepareMetaConnection(channel.provider)}
                      size="sm"
                      variant="outline"
                    >
                      {connectingProvider === channel.provider
                        ? "Preparing..."
                        : `Prepare ${channel.provider}`}
                    </Button>
                    {channel.authorizationUrl ? (
                      <a
                        className={buttonVariants({ size: "sm" })}
                        href={channel.authorizationUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open Meta login
                      </a>
                    ) : null}
                    {channel.provider === "facebook" && channel.authStatus === "connected" ? (
                      <Button
                        disabled={syncingProvider === channel.provider}
                        onClick={() => void syncMetaProviderInsights(channel.provider)}
                        size="sm"
                        variant="outline"
                      >
                        {syncingProvider === channel.provider
                          ? "Syncing..."
                          : "Sync insights"}
                      </Button>
                    ) : null}
                  </div>
                </ListCard>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
