"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AppAccentKey = "sage" | "rose" | "brass" | "tomato" | "ink";
export type ThemeMode = "light" | "dark";

export type AppAccent = {
  key: AppAccentKey;
  label: string;
  description: string;
  bg: string;
  text: string;
  soft: string;
  panel: string;
  primaryHsl: string;
  accentHsl: string;
  ringHsl: string;
};

export const appAccents: AppAccent[] = [
  {
    key: "sage",
    label: "Sage",
    description: "Calm hospitality green for a softer restaurant operating feel.",
    bg: "#b8c4a0",
    text: "#21301f",
    soft: "rgba(184,196,160,0.18)",
    panel: "rgba(184,196,160,0.28)",
    primaryHsl: "78 25% 50%",
    accentHsl: "84 28% 84%",
    ringHsl: "78 26% 44%"
  },
  {
    key: "rose",
    label: "Rose",
    description: "High-visibility campaign color for creative launch work.",
    bg: "#f0a4df",
    text: "#3a1733",
    soft: "rgba(240,164,223,0.18)",
    panel: "rgba(240,164,223,0.28)",
    primaryHsl: "312 62% 67%",
    accentHsl: "312 70% 88%",
    ringHsl: "312 48% 56%"
  },
  {
    key: "brass",
    label: "Brass",
    description: "Warm premium accent that fits client-facing reporting.",
    bg: "#c7a25b",
    text: "#2c2112",
    soft: "rgba(199,162,91,0.2)",
    panel: "rgba(199,162,91,0.3)",
    primaryHsl: "38 44% 48%",
    accentHsl: "42 44% 83%",
    ringHsl: "38 44% 48%"
  },
  {
    key: "tomato",
    label: "Tomato",
    description: "Energetic accent for active promotions and urgency.",
    bg: "#f06b4f",
    text: "#35120b",
    soft: "rgba(240,107,79,0.18)",
    panel: "rgba(240,107,79,0.28)",
    primaryHsl: "10 84% 63%",
    accentHsl: "12 74% 88%",
    ringHsl: "10 70% 54%"
  },
  {
    key: "ink",
    label: "Ink",
    description: "Cooler operational accent for a more structured workspace.",
    bg: "#92a7d9",
    text: "#101a30",
    soft: "rgba(146,167,217,0.18)",
    panel: "rgba(146,167,217,0.3)",
    primaryHsl: "222 48% 63%",
    accentHsl: "222 54% 88%",
    ringHsl: "222 38% 54%"
  }
];

type ThemeContextValue = {
  accent: AppAccent;
  accentKey: AppAccentKey;
  setAccentKey: (key: AppAccentKey) => void;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  accent: appAccents[0],
  accentKey: "sage",
  setAccentKey: () => undefined,
  mode: "light",
  setMode: () => undefined,
  toggleMode: () => undefined
});

function applyAccent(accent: AppAccent) {
  document.documentElement.style.setProperty("--primary", accent.primaryHsl);
  document.documentElement.style.setProperty("--ring", accent.ringHsl);
  document.documentElement.style.setProperty("--accent", accent.accentHsl);
  document.documentElement.style.setProperty("--app-accent-bg", accent.bg);
  document.documentElement.style.setProperty("--app-accent-text", accent.text);
  document.documentElement.style.setProperty("--app-accent-soft", accent.soft);
  document.documentElement.style.setProperty("--app-accent-panel", accent.panel);
}

function applyMode(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [accentKey, setAccentKeyState] = useState<AppAccentKey>("sage");
  const [mode, setModeState] = useState<ThemeMode>("light");

  const accent = appAccents.find((item) => item.key === accentKey) ?? appAccents[0];

  useEffect(() => {
    const savedAccent = window.localStorage.getItem("nmos-app-accent") as AppAccentKey | null;
    const savedMode = window.localStorage.getItem("nmos-theme-mode") as ThemeMode | null;

    if (savedAccent && appAccents.some((item) => item.key === savedAccent)) {
      setAccentKeyState(savedAccent);
    }

    if (savedMode === "dark" || savedMode === "light") {
      setModeState(savedMode);
      applyMode(savedMode);
    } else {
      applyMode("light");
    }

    applyAccent(savedAccent && appAccents.some((item) => item.key === savedAccent) ? appAccents.find((item) => item.key === savedAccent) ?? appAccents[0] : appAccents[0]);
  }, []);

  useEffect(() => {
    applyAccent(accent);
  }, [accent]);

  useEffect(() => {
    applyMode(mode);
  }, [mode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      accent,
      accentKey,
      mode,
      setAccentKey(nextAccentKey) {
        setAccentKeyState(nextAccentKey);
        window.localStorage.setItem("nmos-app-accent", nextAccentKey);
      },
      setMode(nextMode) {
        setModeState(nextMode);
        window.localStorage.setItem("nmos-theme-mode", nextMode);
      },
      toggleMode() {
        setModeState((current) => {
          const nextMode = current === "light" ? "dark" : "light";
          window.localStorage.setItem("nmos-theme-mode", nextMode);
          return nextMode;
        });
      }
    }),
    [accent, accentKey, mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
