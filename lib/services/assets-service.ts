import { seededAssets } from "@/data/seed";
import { mapAssetRow } from "@/lib/supabase/mappers";
import type { Asset } from "@/types";

const assetStore = new Map<string, Asset[]>();

function getClientSnapshot(clientId: string) {
  const existing = assetStore.get(clientId);

  if (existing) {
    return existing;
  }

  const seededSnapshot = seededAssets
    .filter((asset) => asset.clientId === clientId)
    .map((asset) => ({ ...asset }));

  assetStore.set(clientId, seededSnapshot);

  return seededSnapshot;
}

export async function listAssets(clientId: string) {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    const assetRows = data ?? [];
    const assetIds = assetRows.map((asset: { id: string }) => asset.id);

    if (!assetIds.length) {
      return [];
    }

    const { data: links, error: linkError } = await supabase
      .from("campaign_asset_links")
      .select("*")
      .in("asset_id", assetIds);

    if (linkError) {
      throw linkError;
    }

    const campaignMap = new Map<string, string[]>();

    (links ?? []).forEach((row: { asset_id: string; campaign_id: string }) => {
      campaignMap.set(row.asset_id, [...(campaignMap.get(row.asset_id) ?? []), row.campaign_id]);
    });

    return assetRows.map((asset: Parameters<typeof mapAssetRow>[0]) =>
      mapAssetRow(asset, campaignMap.get(asset.id) ?? [])
    );
  }

  return getClientSnapshot(clientId);
}
