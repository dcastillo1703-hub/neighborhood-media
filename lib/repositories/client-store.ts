"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ScopedCollection<T> = Record<string, T[]>;
type ScopedEntity<T> = Record<string, T>;
type CollectionAdapter<T> = {
  isConfigured: boolean;
  load: (clientId: string) => Promise<T[]>;
  save: (clientId: string, items: T[]) => Promise<void>;
};
type EntityAdapter<T> = {
  isConfigured: boolean;
  load: (clientId: string) => Promise<T | null>;
  save: (clientId: string, item: T) => Promise<void>;
};

const collectionMemoryStore = new Map<string, ScopedCollection<unknown>>();
const entityMemoryStore = new Map<string, ScopedEntity<unknown>>();

function readCollectionMemory<T>(storageKey: string, clientId: string) {
  const store = collectionMemoryStore.get(storageKey) as ScopedCollection<T> | undefined;

  return store?.[clientId];
}

function writeCollectionMemory<T>(storageKey: string, clientId: string, items: T[]) {
  const store = (collectionMemoryStore.get(storageKey) as ScopedCollection<T> | undefined) ?? {};
  collectionMemoryStore.set(storageKey, {
    ...store,
    [clientId]: items
  });
}

function readEntityMemory<T>(storageKey: string, clientId: string) {
  const store = entityMemoryStore.get(storageKey) as ScopedEntity<T> | undefined;

  return store?.[clientId];
}

function writeEntityMemory<T>(storageKey: string, clientId: string, entity: T) {
  const store = (entityMemoryStore.get(storageKey) as ScopedEntity<T> | undefined) ?? {};
  entityMemoryStore.set(storageKey, {
    ...store,
    [clientId]: entity
  });
}

export function useScopedCollection<T>(
  storageKey: string,
  clientId: string,
  seed: T[],
  adapter?: CollectionAdapter<T>
) {
  const seedRef = useRef(seed);
  const [ready, setReady] = useState(false);
  const [store, setStore] = useState<ScopedCollection<T>>(() => {
    const memory = readCollectionMemory<T>(storageKey, clientId);
    const initialItems = memory ?? (adapter?.isConfigured ? [] : seed);
    writeCollectionMemory(storageKey, clientId, initialItems);

    return { [clientId]: initialItems };
  });

  useEffect(() => {
    seedRef.current = seed;
  }, [seed]);

  useEffect(() => {
    let isActive = true;
    const memory = readCollectionMemory<T>(storageKey, clientId);

    if (memory) {
      setStore((currentStore) => ({
        ...currentStore,
        [clientId]: memory
      }));
    }

    const load = async () => {
      if (!adapter?.isConfigured) {
        const fallback = memory ?? seedRef.current;
        writeCollectionMemory(storageKey, clientId, fallback);

        if (isActive) {
          setStore((currentStore) => ({
            ...currentStore,
            [clientId]: fallback
          }));
          setReady(true);
        }

        return;
      }

      try {
        const nextItems = await adapter.load(clientId);

        writeCollectionMemory(storageKey, clientId, nextItems);

        if (isActive) {
          setStore((currentStore) => ({
            ...currentStore,
            [clientId]: nextItems
          }));
        }
      } catch (error) {
        const fallback = memory ?? [];
        writeCollectionMemory(storageKey, clientId, fallback);

        if (isActive) {
          setStore((currentStore) => ({
            ...currentStore,
            [clientId]: fallback
          }));
        }

        console.error(`Failed to load ${storageKey} for client ${clientId}`, error);
      } finally {
        if (isActive) {
          setReady(true);
        }
      }
    };

    setReady(false);
    void load();

    return () => {
      isActive = false;
    };
  }, [adapter, clientId, storageKey]);

  const items = useMemo(
    () => store[clientId] ?? (adapter?.isConfigured ? [] : seedRef.current),
    [adapter?.isConfigured, clientId, store]
  );

  const setItems = (updater: T[] | ((current: T[]) => T[])) => {
    setStore((currentStore) => {
      const currentItems = currentStore[clientId] ?? seedRef.current;
      const nextItems = typeof updater === "function" ? updater(currentItems) : updater;
      writeCollectionMemory(storageKey, clientId, nextItems);

      if (adapter?.isConfigured) {
        void adapter.save(clientId, nextItems).catch((error) => {
          writeCollectionMemory(storageKey, clientId, currentItems);
          setStore((rollbackStore) => ({
            ...rollbackStore,
            [clientId]: currentItems
          }));
          console.error(`Failed to persist ${storageKey} for client ${clientId}`, error);
        });
      }

      return {
        ...currentStore,
        [clientId]: nextItems
      };
    });
  };

  return [items, setItems, ready] as const;
}

export function useScopedEntity<T>(
  storageKey: string,
  clientId: string,
  seed: T,
  adapter?: EntityAdapter<T>
) {
  const seedRef = useRef(seed);
  const [ready, setReady] = useState(false);
  const [store, setStore] = useState<ScopedEntity<T>>(() => {
    const memory = readEntityMemory<T>(storageKey, clientId);
    const initialEntity = memory ?? seed;
    writeEntityMemory(storageKey, clientId, initialEntity);

    return { [clientId]: initialEntity };
  });

  useEffect(() => {
    seedRef.current = seed;
  }, [seed]);

  useEffect(() => {
    let isActive = true;
    const memory = readEntityMemory<T>(storageKey, clientId);

    if (memory) {
      setStore((currentStore) => ({
        ...currentStore,
        [clientId]: memory
      }));
    }

    const load = async () => {
      if (!adapter?.isConfigured) {
        const fallback = memory ?? seedRef.current;
        writeEntityMemory(storageKey, clientId, fallback);

        if (isActive) {
          setStore((currentStore) => ({
            ...currentStore,
            [clientId]: fallback
          }));
          setReady(true);
        }

        return;
      }

      try {
        const nextEntity = await adapter.load(clientId);
        const resolvedEntity = nextEntity ?? (memory ?? seedRef.current);

        writeEntityMemory(storageKey, clientId, resolvedEntity);

        if (isActive) {
          setStore((currentStore) => ({
            ...currentStore,
            [clientId]: resolvedEntity
          }));
        }
      } catch (error) {
        const fallback = memory ?? seedRef.current;
        writeEntityMemory(storageKey, clientId, fallback);

        if (isActive) {
          setStore((currentStore) => ({
            ...currentStore,
            [clientId]: fallback
          }));
        }

        console.error(`Failed to load ${storageKey} for client ${clientId}`, error);
      } finally {
        if (isActive) {
          setReady(true);
        }
      }
    };

    setReady(false);
    void load();

    return () => {
      isActive = false;
    };
  }, [adapter, clientId, storageKey]);

  const entity = store[clientId] ?? seedRef.current;

  const setEntity = (updater: T | ((current: T) => T)) => {
    setStore((currentStore) => {
      const currentEntity = currentStore[clientId] ?? seedRef.current;
      const nextEntity =
        typeof updater === "function"
          ? (updater as (current: T) => T)(currentEntity)
          : updater;
      writeEntityMemory(storageKey, clientId, nextEntity);

      if (adapter?.isConfigured) {
        void adapter.save(clientId, nextEntity).catch((error) => {
          writeEntityMemory(storageKey, clientId, currentEntity);
          setStore((rollbackStore) => ({
            ...rollbackStore,
            [clientId]: currentEntity
          }));
          console.error(`Failed to persist ${storageKey} for client ${clientId}`, error);
        });
      }

      return {
        ...currentStore,
        [clientId]: nextEntity
      };
    });
  };

  return [entity, setEntity, ready] as const;
}
