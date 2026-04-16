"use client";

import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";

type StoredDraftEnvelope<T> = {
  value: T;
  updatedAt: string;
};

type InitialValue<T> = T | (() => T);

const draftStoragePrefix = "nmos:draft:";

function resolveInitialValue<T>(value: InitialValue<T>) {
  return typeof value === "function" ? (value as () => T)() : value;
}

function getStorageKey(key: string) {
  return `${draftStoragePrefix}${key}`;
}

function readDraftValue<T>(key: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(getStorageKey(key));

    if (!storedValue) {
      return null;
    }

    const parsedValue = JSON.parse(storedValue) as StoredDraftEnvelope<T> | T;

    if (
      parsedValue &&
      typeof parsedValue === "object" &&
      "value" in parsedValue
    ) {
      return (parsedValue as StoredDraftEnvelope<T>).value;
    }

    return parsedValue as T;
  } catch {
    return null;
  }
}

function writeDraftValue<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    getStorageKey(key),
    JSON.stringify({
      value,
      updatedAt: new Date().toISOString()
    } satisfies StoredDraftEnvelope<T>)
  );
}

export function clearPersistentDraft(key: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(getStorageKey(key));
}

export function usePersistentDraft<T>(key: string, initialValue: InitialValue<T>) {
  const initialValueRef = useRef(initialValue);
  initialValueRef.current = initialValue;

  const [value, setValueState] = useState<T>(() => resolveInitialValue(initialValueRef.current));
  const [hydrated, setHydrated] = useState(typeof window === "undefined");
  const [isDirty, setIsDirty] = useState(false);
  const dirtyRef = useRef(false);

  useEffect(() => {
    const storedDraft = readDraftValue<T>(key);

    if (storedDraft !== null) {
      dirtyRef.current = true;
      setIsDirty(true);
      setValueState(storedDraft);
      setHydrated(true);
      return;
    }

    dirtyRef.current = false;
    setIsDirty(false);
    setValueState(resolveInitialValue(initialValueRef.current));
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncFromStorage = (event: StorageEvent) => {
      if (event.key !== getStorageKey(key)) {
        return;
      }

      const storedDraft = readDraftValue<T>(key);

      if (storedDraft === null) {
        dirtyRef.current = false;
        setIsDirty(false);
        setValueState(resolveInitialValue(initialValueRef.current));
        return;
      }

      dirtyRef.current = true;
      setIsDirty(true);
      setValueState(storedDraft);
    };

    window.addEventListener("storage", syncFromStorage);
    return () => window.removeEventListener("storage", syncFromStorage);
  }, [key]);

  const setValue = useCallback(
    (nextValue: SetStateAction<T>) => {
      setValueState((currentValue) => {
        const resolvedValue =
          typeof nextValue === "function"
            ? (nextValue as (value: T) => T)(currentValue)
            : nextValue;

        dirtyRef.current = true;
        setIsDirty(true);
        writeDraftValue(key, resolvedValue);

        return resolvedValue;
      });
    },
    [key]
  );

  const syncFromSource = useCallback((nextValue: T) => {
    setValueState((currentValue) => (dirtyRef.current ? currentValue : nextValue));
  }, []);

  const reset = useCallback(
    (nextValue?: InitialValue<T>) => {
      const resolvedValue =
        nextValue === undefined
          ? resolveInitialValue(initialValueRef.current)
          : resolveInitialValue(nextValue);

      clearPersistentDraft(key);
      dirtyRef.current = false;
      setIsDirty(false);
      setValueState(resolvedValue);
    },
    [key]
  );

  return {
    value,
    setValue,
    syncFromSource,
    reset,
    hydrated,
    isDirty
  };
}
