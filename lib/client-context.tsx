"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { meamaClient, meamaSettings, seededClientSettings } from "@/data/seed";
import { useClientSettings } from "@/lib/repositories/use-client-settings";
import { useClients } from "@/lib/repositories/use-clients";
import { Client, ClientSettings } from "@/types";

type ClientContextValue = {
  clients: Client[];
  activeClient: Client;
  activeSettings: ClientSettings;
  setActiveClientId: (clientId: string) => void;
  ready: boolean;
};

const ClientContext = createContext<ClientContextValue>({
  clients: [meamaClient],
  activeClient: meamaClient,
  activeSettings: meamaSettings,
  setActiveClientId: () => undefined
  ,
  ready: false
});

export function ClientProvider({ children }: { children: ReactNode }) {
  const { clients, ready: clientsReady } = useClients();
  const [activeClientId, setActiveClientId] = useState(meamaClient.id);
  const activeClient = useMemo(
    () => clients.find((client) => client.id === activeClientId) ?? clients[0] ?? meamaClient,
    [activeClientId, clients]
  );
  const { settings: activeSettings, ready: settingsReady } = useClientSettings(activeClient.id);

  useEffect(() => {
    if (!clients.length) {
      return;
    }

    const stillExists = clients.some((client) => client.id === activeClientId);

    if (!stillExists) {
      setActiveClientId(clients[0].id);
    }
  }, [activeClientId, clients]);

  const fallbackSettings =
    seededClientSettings.find((settings) => settings.clientId === activeClient.id) ?? meamaSettings;

  const value = useMemo(
    () => ({
      clients: clients.length ? clients : [meamaClient],
      activeClient,
      activeSettings: activeSettings ?? fallbackSettings,
      setActiveClientId,
      ready: clientsReady && settingsReady
    }),
    [activeClient, activeSettings, clients, clientsReady, fallbackSettings, settingsReady]
  );

  return <ClientContext.Provider value={value}>{children}</ClientContext.Provider>;
}

export function useActiveClient() {
  return useContext(ClientContext);
}
