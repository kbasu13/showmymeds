import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export const THEMES = [
  { id: "sage", label: "Sage Garden" },
  { id: "ocean", label: "Calm Ocean" },
  { id: "sunrise", label: "Warm Sunrise" },
  { id: "contrast", label: "High Contrast" },
] as const;
export type ThemeId = (typeof THEMES)[number]["id"];
export type SizeId = "normal" | "large";

type Prefs = { theme: ThemeId; size: SizeId; setTheme: (t: ThemeId) => void; setSize: (s: SizeId) => void };
const Ctx = createContext<Prefs | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeId>("sage");
  const [size, setSize] = useState<SizeId>("normal");

  useEffect(() => {
    const t = localStorage.getItem("smm-theme") as ThemeId | null;
    const s = localStorage.getItem("smm-size") as SizeId | null;
    if (t) setTheme(t);
    if (s) setSize(s);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("smm-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle("size-large", size === "large");
    localStorage.setItem("smm-size", size);
  }, [size]);

  return <Ctx.Provider value={{ theme, size, setTheme, setSize }}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePrefs outside provider");
  return c;
}
