"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useLocalStorage<T>(key: string, initialValue: T | (() => T)) {
  const initialRef = useRef(initialValue);
  const getInitialValue = useCallback(
    () =>
      typeof initialRef.current === "function"
        ? (initialRef.current as () => T)()
        : initialRef.current,
    []
  );

  const [value, setValue] = useState<T>(getInitialValue);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) {
        setValue(JSON.parse(stored) as T);
      } else {
        setValue(getInitialValue());
      }
    } catch {
      setValue(getInitialValue());
    } finally {
      setReady(true);
    }
  }, [getInitialValue, key]);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, ready, value]);

  return [value, setValue, ready] as const;
}
