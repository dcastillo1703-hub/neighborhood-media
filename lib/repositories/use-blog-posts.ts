"use client";

import { useEffect, useState } from "react";

import type { BlogPost } from "@/types";

type BlogPostsResponse = {
  blogPosts: BlogPost[];
};

export function useBlogPosts(clientId: string) {
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setReady(false);
      setError(null);

      try {
        const response = await fetch(
          `/api/blog-posts?clientId=${encodeURIComponent(clientId)}`,
          {
            method: "GET",
            cache: "no-store"
          }
        );

        if (!response.ok) {
          throw new Error("Failed to load blog posts.");
        }

        const payload = (await response.json()) as BlogPostsResponse;

        if (active) {
          setBlogPosts(payload.blogPosts);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load blog posts.");
          setBlogPosts([]);
        }
      } finally {
        if (active) {
          setReady(true);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [clientId]);

  return { blogPosts, ready, error };
}
