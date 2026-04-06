"use client";

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ListCard } from "@/components/dashboard/list-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { slowNightIdeas } from "@/data/seed";
import { useActiveClient } from "@/lib/client-context";
import { getPlannerItemsForDay } from "@/lib/domain/content";
import { useCampaigns } from "@/lib/repositories/use-campaigns";
import { usePlannerItems } from "@/lib/repositories/use-planner-items";
import { validatePlannerItem } from "@/lib/validation";
import { DayOfWeek, PlannerItem, PlannerStatus } from "@/types";

const days: DayOfWeek[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
];

const createEmptyPlannerItem = (clientId: string): PlannerItem => ({
  id: "",
  clientId,
  dayOfWeek: "Monday",
  platform: "Instagram",
  contentType: "Reel",
  campaignGoal: "",
  status: "Draft",
  caption: ""
});

export default function MarketingPlannerPage() {
  const { activeClient } = useActiveClient();
  const { campaigns } = useCampaigns(activeClient.id);
  const { items, addItem, updateStatus, ready, error } = usePlannerItems(activeClient.id);
  const [draft, setDraft] = useState<PlannerItem>(createEmptyPlannerItem(activeClient.id));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraft(createEmptyPlannerItem(activeClient.id));
  }, [activeClient.id]);

  const savePlannerItem = () => {
    const result = validatePlannerItem(draft);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }

    void addItem({
      ...draft,
      ...result.data,
      clientId: activeClient.id
    })
      .then(() => {
        setErrors({});
        setDraft(createEmptyPlannerItem(activeClient.id));
      })
      .catch(() => {
        setErrors({
          form: "Planner item could not be saved. Check backend connectivity and permissions."
        });
      });
  };

  if (!ready) {
    return <div className="text-sm text-muted-foreground">Loading marketing planner...</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive">{error}</div>;
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Marketing planner"
        title="Marketing planner"
        description="Plan content by day, platform, and campaign goal."
      />
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <div>
              <CardDescription>Planner Builder</CardDescription>
              <CardTitle className="mt-3">Map restaurant content Monday-Sunday</CardTitle>
            </div>
          </CardHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Day</Label>
                <Select
                  value={draft.dayOfWeek}
                  onChange={(value) => setDraft((current) => ({ ...current, dayOfWeek: value as DayOfWeek }))}
                  options={days.map((day) => ({ label: day, value: day }))}
                />
                {errors.dayOfWeek ? <p className="mt-2 text-xs text-primary">{errors.dayOfWeek}</p> : null}
              </div>
              <div>
                <Label>Platform</Label>
                <Select
                  value={draft.platform}
                  onChange={(value) => setDraft((current) => ({ ...current, platform: value as PlannerItem["platform"] }))}
                  options={["Instagram", "Stories", "TikTok", "Email"].map((value) => ({ label: value, value }))}
                />
                {errors.platform ? <p className="mt-2 text-xs text-primary">{errors.platform}</p> : null}
              </div>
              <div>
                <Label>Content Type</Label>
                <Input
                  value={draft.contentType}
                  onChange={(event) => setDraft((current) => ({ ...current, contentType: event.target.value }))}
                />
                {errors.contentType ? <p className="mt-2 text-xs text-primary">{errors.contentType}</p> : null}
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={draft.status}
                  onChange={(value) => setDraft((current) => ({ ...current, status: value as PlannerStatus }))}
                  options={["Draft", "Scheduled", "Published"].map((value) => ({ label: value, value }))}
                />
              </div>
            </div>
            <div>
              <Label>Campaign Goal</Label>
              <Input
                value={draft.campaignGoal}
                onChange={(event) => setDraft((current) => ({ ...current, campaignGoal: event.target.value }))}
                placeholder="Drive Tuesday covers"
              />
              {errors.campaignGoal ? <p className="mt-2 text-xs text-primary">{errors.campaignGoal}</p> : null}
            </div>
            <div>
              <Label>Campaign Link</Label>
              <Select
                value={draft.campaignId ?? "none"}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    campaignId: value === "none" ? undefined : value
                  }))
                }
                options={[
                  { label: "No linked campaign", value: "none" },
                  ...campaigns.map((campaign) => ({ label: campaign.name, value: campaign.id }))
                ]}
              />
            </div>
            <div>
              <Label>Caption / Idea</Label>
              <Textarea
                value={draft.caption}
                onChange={(event) => setDraft((current) => ({ ...current, caption: event.target.value }))}
                placeholder="Describe the post angle or creative brief."
              />
              {errors.caption ? <p className="mt-2 text-xs text-primary">{errors.caption}</p> : null}
            </div>
            {errors.form ? <p className="text-xs text-primary">{errors.form}</p> : null}
            <Button onClick={savePlannerItem}>Add Planner Item</Button>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardDescription>Seeded Slow-Night Plays</CardDescription>
              <CardTitle className="mt-3">Slow-night ideas</CardTitle>
            </div>
          </CardHeader>
          <div className="grid gap-3 md:grid-cols-2">
            {slowNightIdeas.map((idea) => (
              <div className="rounded-2xl border border-border/60 bg-card/65 p-4 text-sm text-muted-foreground" key={idea}>
                {idea}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardDescription>Weekly Planner</CardDescription>
            <CardTitle className="mt-3">Monday through Sunday</CardTitle>
          </div>
        </CardHeader>
        <div className="grid gap-4 xl:grid-cols-7">
          {days.map((day) => {
            const dayItems = getPlannerItemsForDay(items, day);

            return (
              <div className="rounded-2xl border border-border/60 bg-card/60 p-4" key={day}>
                <p className="font-display text-xl text-foreground">{day}</p>
                <div className="mt-4 space-y-3">
                  {dayItems.length ? (
                    dayItems.map((item) => (
                      <ListCard className="bg-card/70 p-3" key={item.id}>
                        <p className="text-sm font-medium text-foreground">{item.platform}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-primary">{item.contentType}</p>
                        <p className="mt-2 text-sm text-muted-foreground">{item.caption}</p>
                        <p className="mt-2 text-sm text-foreground">{item.campaignGoal}</p>
                        {item.campaignId ? (
                          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-primary">Campaign: {item.campaignId}</p>
                        ) : null}
                        {item.linkedPostId ? (
                          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Linked post: {item.linkedPostId}</p>
                        ) : null}
                        <select
                          className="mt-3 w-full rounded-xl border border-border bg-card/70 px-3 py-2 text-sm text-foreground"
                          value={item.status}
                          onChange={(event) => {
                            void updateStatus(item.id, event.target.value as PlannerStatus).catch(() => {
                              setErrors({
                                form: "Planner item status could not be updated. Check backend connectivity and permissions."
                              });
                            });
                          }}
                        >
                          {["Draft", "Scheduled", "Published"].map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </ListCard>
                    ))
                  ) : (
                    <EmptyState
                      title="Open slot"
                      description="Use this day for a slow-night or reservation-driving idea."
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
