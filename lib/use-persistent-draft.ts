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

function serializeDraftValue<T>(value: T) {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
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
  const latestValueRef = useRef(value);
  const lastWrittenValueRef = useRef<string | null>(serializeDraftValue(value));
  const pendingWriteHandleRef = useRef<number | null>(null);

  latestValueRef.current = value;

  const flushDraftWrite = useCallback(
    (targetKey = key) => {
      if (typeof window === "undefined" || !dirtyRef.current) {
        return;
      }

      const serializedValue = serializeDraftValue(latestValueRef.current);

      if (serializedValue === null || serializedValue === lastWrittenValueRef.current) {
        return;
      }

      writeDraftValue(targetKey, latestValueRef.current);
      lastWrittenValueRef.current = serializedValue;
    },
    [key]
  );

  const cancelPendingWrite = useCallback(() => {
    if (pendingWriteHandleRef.current === null || typeof window === "undefined") {
      return;
    }

    const idleWindow = window as Window & {
      requestIdleCallback?: typeof requestIdleCallback;
      cancelIdleCallback?: typeof cancelIdleCallback;
    };

    if (idleWindow.cancelIdleCallback) {
      idleWindow.cancelIdleCallback(pendingWriteHandleRef.current);
    } else {
      window.clearTimeout(pendingWriteHandleRef.current);
    }

    pendingWriteHandleRef.current = null;
  }, []);

  useEffect(() => {
    const storedDraft = readDraftValue<T>(key);

    if (storedDraft !== null) {
      cancelPendingWrite();
      dirtyRef.current = true;
      setIsDirty(true);
      setValueState(storedDraft);
      latestValueRef.current = storedDraft;
      lastWrittenValueRef.current = serializeDraftValue(storedDraft);
      setHydrated(true);
      return;
    }

    cancelPendingWrite();
    dirtyRef.current = false;
    setIsDirty(false);
    const resolvedValue = resolveInitialValue(initialValueRef.current);
    setValueState(resolvedValue);
    latestValueRef.current = resolvedValue;
    lastWrittenValueRef.current = serializeDraftValue(resolvedValue);
    setHydrated(true);
  }, [cancelPendingWrite, key]);

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
        cancelPendingWrite();
        dirtyRef.current = false;
        setIsDirty(false);
        const resolvedValue = resolveInitialValue(initialValueRef.current);
        setValueState(resolvedValue);
        latestValueRef.current = resolvedValue;
        lastWrittenValueRef.current = serializeDraftValue(resolvedValue);
        return;
      }

      cancelPendingWrite();
      dirtyRef.current = true;
      setIsDirty(true);
      setValueState(storedDraft);
      latestValueRef.current = storedDraft;
      lastWrittenValueRef.current = serializeDraftValue(storedDraft);
    };

    window.addEventListener("storage", syncFromStorage);
    return () => window.removeEventListener("storage", syncFromStorage);
  }, [cancelPendingWrite, key]);

  useEffect(() => {
    if (!hydrated || !dirtyRef.current || typeof window === "undefined") {
      return;
    }

    cancelPendingWrite();

    const scheduleWrite = () => {
      flushDraftWrite();
      pendingWriteHandleRef.current = null;
    };

    const idleWindow = window as Window & {
      requestIdleCallback?: typeof requestIdleCallback;
    };

    if (idleWindow.requestIdleCallback) {
      pendingWriteHandleRef.current = idleWindow.requestIdleCallback(scheduleWrite, {
        timeout: 250
      });
    } else {
      pendingWriteHandleRef.current = window.setTimeout(scheduleWrite, 120);
    }

    return () => {
      cancelPendingWrite();
    };
  }, [cancelPendingWrite, flushDraftWrite, hydrated, key, value]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const flushBeforeUnload = () => {
      flushDraftWrite();
    };

    window.addEventListener("beforeunload", flushBeforeUnload);

    return () => {
      flushDraftWrite();
      window.removeEventListener("beforeunload", flushBeforeUnload);
    };
  }, [flushDraftWrite]);

  const setValue = useCallback(
    (nextValue: SetStateAction<T>) => {
      setValueState((currentValue) => {
        const resolvedValue =
          typeof nextValue === "function"
            ? (nextValue as (value: T) => T)(currentValue)
            : nextValue;

        dirtyRef.current = true;
        setIsDirty(true);
        latestValueRef.current = resolvedValue;

        return resolvedValue;
      });
    },
    []
  );

  const syncFromSource = useCallback((nextValue: T) => {
    setValueState((currentValue) => {
      if (dirtyRef.current) {
        return currentValue;
      }

      latestValueRef.current = nextValue;
      lastWrittenValueRef.current = serializeDraftValue(nextValue);
      return nextValue;
    });
  }, []);

  const reset = useCallback(
    (nextValue?: InitialValue<T>) => {
      const resolvedValue =
        nextValue === undefined
          ? resolveInitialValue(initialValueRef.current)
          : resolveInitialValue(nextValue);

      cancelPendingWrite();
      clearPersistentDraft(key);
      dirtyRef.current = false;
      setIsDirty(false);
      setValueState(resolvedValue);
      latestValueRef.current = resolvedValue;
      lastWrittenValueRef.current = serializeDraftValue(resolvedValue);
    },
    [cancelPendingWrite, key]
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
