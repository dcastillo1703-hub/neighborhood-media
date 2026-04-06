import { seededBlogPosts } from "@/data/seed";
import { mapBlogPostRow } from "@/lib/supabase/mappers";
import type { BlogPost } from "@/types";

const blogStore = new Map<string, BlogPost[]>();

function getClientSnapshot(clientId: string) {
  const existing = blogStore.get(clientId);

  if (existing) {
    return existing;
  }

  const seededSnapshot = seededBlogPosts
    .filter((post) => post.clientId === clientId)
    .map((post) => ({ ...post }));

  blogStore.set(clientId, seededSnapshot);

  return seededSnapshot;
}

export async function listBlogPosts(clientId: string) {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await serverModule.getSupabaseServerClient()) as any;

  if (supabase) {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    const blogRows = data ?? [];
    const blogIds = blogRows.map((post: { id: string }) => post.id);

    if (!blogIds.length) {
      return [];
    }

    const { data: links, error: linkError } = await supabase
      .from("blog_assets")
      .select("*")
      .in("blog_post_id", blogIds);

    if (linkError) {
      throw linkError;
    }

    const assetMap = new Map<string, string[]>();

    (links ?? []).forEach((row: { blog_post_id: string; asset_id: string }) => {
      assetMap.set(row.blog_post_id, [...(assetMap.get(row.blog_post_id) ?? []), row.asset_id]);
    });

    return blogRows.map((post: Parameters<typeof mapBlogPostRow>[0]) =>
      mapBlogPostRow(post, assetMap.get(post.id) ?? [])
    );
  }

  return getClientSnapshot(clientId);
}
