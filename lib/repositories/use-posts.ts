"use client";

import { useEffect, useState } from "react";

import type { ActivityEvent, ApprovalRequest, Post, PublishJob } from "@/types";

type PostsResponse = {
  posts: Post[];
};

type CreatePostInput = Omit<Post, "id" | "createdAt">;
type UpdatePostInput = Partial<Omit<Post, "id" | "clientId" | "createdAt">>;

export function usePosts(clientId: string) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setReady(false);
      setError(null);

      try {
        const response = await fetch(`/api/posts?clientId=${encodeURIComponent(clientId)}`, {
          method: "GET",
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("Failed to load posts.");
        }

        const payload = (await response.json()) as PostsResponse;

        if (active) {
          setPosts(payload.posts);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load posts.");
          setPosts([]);
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

  return {
    posts,
    ready,
    error,
    async addPost(post: CreatePostInput) {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(post)
      });

      if (!response.ok) {
        throw new Error("Failed to create post.");
      }

      const payload = (await response.json()) as {
        post: Post;
        event: ActivityEvent;
        approval: ApprovalRequest | null;
        publishJob: PublishJob | null;
      };

      setPosts((current) => [...current, payload.post]);

      return payload;
    },
    async updatePost(postId: string, updates: UpdatePostInput) {
      const response = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ clientId, ...updates })
      });

      if (!response.ok) {
        throw new Error("Failed to update post.");
      }

      const payload = (await response.json()) as {
        post: Post;
        event: ActivityEvent;
        approval: ApprovalRequest | null;
      };

      setPosts((current) =>
        current.map((post) => (post.id === payload.post.id ? payload.post : post))
      );

      return payload;
    }
  };
}
