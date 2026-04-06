"use client";

import { useEffect, useMemo, useState } from "react";

import { seededClients } from "@/data/seed";
import { Client } from "@/types";

export function useClients() {
  const seed = useMemo(() => seededClients, []);
  const [clients, setClients] = useState<Client[]>(seed);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setReady(false);

      try {
        const response = await fetch("/api/clients?workspaceId=ws-neighborhood", {
          method: "GET",
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("Failed to load clients.");
        }

        const payload = (await response.json()) as { clients: Client[] };

        if (active) {
          setClients(payload.clients);
        }
      } catch {
        if (active) {
          setClients(seed);
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
  }, [seed]);

  return {
    clients,
    ready,
    setClients
  };
}
