"use client";

import { useCallback } from "react";

import { usePersistentDraft } from "@/lib/use-persistent-draft";
import type { ToastPerformanceImport } from "@/types";

export function useToastPerformanceImports(clientId: string) {
  const storageKey = `toast-performance-imports:${clientId}`;
  const {
    value: imports,
    setValue: setImports
  } = usePersistentDraft<ToastPerformanceImport[]>(storageKey, []);

  const upsertImport = useCallback(
    (nextImport: ToastPerformanceImport) => {
      setImports((current) => {
        const existingIndex = current.findIndex((item) => item.id === nextImport.id);

        if (existingIndex === -1) {
          return [nextImport, ...current];
        }

        const nextItems = [...current];
        nextItems[existingIndex] = nextImport;
        return nextItems;
      });
    },
    [setImports]
  );

  const approveImport = useCallback(
    (importId: string, appliedMetricIds: string[]) => {
      setImports((current) =>
        current.map((item) =>
          item.id === importId
            ? {
                ...item,
                status: "approved",
                approvedAt: new Date().toISOString(),
                appliedMetricIds
              }
            : item
        )
      );
    },
    [setImports]
  );

  return {
    imports,
    upsertImport,
    approveImport
  };
}
