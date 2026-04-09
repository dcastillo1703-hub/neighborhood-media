"use client";

import { useState } from "react";
import { ArrowUpRight, Globe2, Link2, MousePointerClick, RefreshCcw } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ListCard } from "@/components/dashboard/list-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatGrid } from "@/components/dashboard/stat-grid";
import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useActiveClient } from "@/lib/client-context";
import { useGoogleAnalytics } from "@/lib/use-google-analytics";
import { number } from "@/lib/utils";

export default function WebAnalyticsPage() {
  const { activeClient } = useActiveClient();
  const { summary, ready, error, sync } = useGoogleAnalytics(activeClient.id);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const topSource = summary?.topSources[0] ?? null;
  const topPage = summary?.topPages[0] ?? null;
  const digest = summary
    ? topSource && topPage
      ? `${activeClient.name} brought in ${number(summary.sessions)} sessions in ${
          summary.periodLabel ?? "the latest sync"
        }. ${topSource.label} is the strongest traffic source, and ${topPage.path} is the page getting the clearest attention.`
      : `${activeClient.name} brought in ${number(summary.sessions)} sessions in ${
          summary.periodLabel ?? "the latest sync"
        }. Run another sync after campaign changes if you want a fresher website read.`
    : "Sync Google Analytics to turn website traffic into a clear client-facing read.";

  const runSync = async () => {
    setSyncing(true);
    setNotice(null);

    try {
      const payload = await sync();
      setNotice(
        `Google Analytics synced. Sessions: ${number(payload.summary.sessions)}, users: ${number(
          payload.summary.users
        )}, views: ${number(payload.summary.views)}.`
      );
    } catch (syncError) {
      setNotice(
        syncError instanceof Error
          ? syncError.message
          : "Unable to sync Google Analytics."
      );
    } finally {
      setSyncing(false);
    }
  };

  if (!ready) {
    return <div className="text-sm text-muted-foreground">Loading web analytics...</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive">{error}</div>;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Web analytics"
        title="See what the website is actually doing"
        description="Keep website traffic in its own readable workspace so you can quickly answer what is getting attention, where it is coming from, and which pages deserve a campaign push."
        actions={
          <Button size="sm" onClick={() => void runSync()} disabled={syncing || !summary?.readyToSync}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            {syncing ? "Syncing..." : "Sync Google Analytics"}
          </Button>
        }
      />

      <Card className="p-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <CardDescription>Website Read</CardDescription>
            <CardTitle className="mt-3">What traffic is saying right now</CardTitle>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{digest}</p>
            {notice ? <p className="mt-3 text-sm text-muted-foreground">{notice}</p> : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[28rem]">
            <div className="rounded-2xl bg-muted/50 px-4 py-3">
              <p className="text-xs text-muted-foreground">Top source</p>
              <p className="mt-2 truncate text-lg font-medium text-foreground">
                {topSource?.label ?? "No source yet"}
              </p>
            </div>
            <div className="rounded-2xl bg-muted/50 px-4 py-3">
              <p className="text-xs text-muted-foreground">Top landing page</p>
              <p className="mt-2 truncate text-lg font-medium text-foreground">
                {topPage?.path ?? "/"}
              </p>
            </div>
            <div className="rounded-2xl bg-muted/50 px-4 py-3">
              <p className="text-xs text-muted-foreground">Reporting window</p>
              <p className="mt-2 truncate text-lg font-medium text-foreground">
                {summary?.periodLabel ?? "Last 30 days"}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <StatGrid>
        <MetricCard href="/web-analytics" label="Sessions" value={number(summary?.sessions ?? 0)} detail="Overall website sessions in the latest synced window." />
        <MetricCard href="/web-analytics" label="Users" value={number(summary?.users ?? 0)} detail="Individual visitors seen by GA4." />
        <MetricCard href="/web-analytics" label="Views" value={number(summary?.views ?? 0)} detail="Page or screen views in the same reporting window." />
        <MetricCard href="/web-analytics" label="Events" value={number(summary?.events ?? 0)} detail="Tracked GA4 events, useful for form clicks and intent." />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <div>
              <CardDescription>Traffic sources</CardDescription>
              <CardTitle className="mt-3">Where website visits are coming from</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-3">
            {summary?.topSources.length ? (
              summary.topSources.map((source, index) => (
                <ListCard key={`${source.label}-${index}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Globe2 className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-medium text-foreground">{source.label}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Strong source to keep an eye on for campaign traffic.
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-foreground">{number(source.sessions)} sessions</p>
                  </div>
                </ListCard>
              ))
            ) : (
              <EmptyState
                title="No traffic sources yet"
                description="Run a sync once traffic is flowing into GA4 and the strongest sources will appear here."
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardDescription>Landing pages</CardDescription>
              <CardTitle className="mt-3">What pages people are actually landing on</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-3">
            {summary?.topPages.length ? (
              summary.topPages.map((page, index) => (
                <ListCard key={`${page.path}-${index}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Link2 className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-medium text-foreground">{page.path}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Candidate page to support with UTMs, offers, or campaign links.
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-foreground">{number(page.views)} views</p>
                  </div>
                </ListCard>
              ))
            ) : (
              <EmptyState
                title="No landing pages yet"
                description="Once GA4 syncs page traffic, your most relevant landing pages will show up here."
              />
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardDescription>How to use this page</CardDescription>
            <CardTitle className="mt-3">Turn traffic into action</CardTitle>
          </div>
        </CardHeader>
        <div className="grid gap-3 md:grid-cols-3">
          <ListCard>
            <div className="flex items-start gap-3">
              <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <ArrowUpRight className="h-4 w-4" />
              </span>
              <div>
                <p className="font-medium text-foreground">Support the strongest source</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  If one source is clearly leading, mirror its language and links in the next campaign.
                </p>
              </div>
            </div>
          </ListCard>
          <ListCard>
            <div className="flex items-start gap-3">
              <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <MousePointerClick className="h-4 w-4" />
              </span>
              <div>
                <p className="font-medium text-foreground">Watch landing-page intent</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The top page is usually where campaign links and calls-to-action should point first.
                </p>
              </div>
            </div>
          </ListCard>
          <ListCard>
            <div className="flex items-start gap-3">
              <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <RefreshCcw className="h-4 w-4" />
              </span>
              <div>
                <p className="font-medium text-foreground">Resync after campaigns change</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sync again after a push goes live so the traffic read reflects the newest campaign window.
                </p>
              </div>
            </div>
          </ListCard>
        </div>
      </Card>
    </div>
  );
}
