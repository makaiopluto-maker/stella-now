"use client";

import { useEffect, type ReactNode } from "react";
import { applyTheme, readTheme, subscribeTheme } from "@/lib/theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyTheme(readTheme());
    const stop = subscribeTheme(() => applyTheme(readTheme()));
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readTheme() === "system") applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => {
      stop();
      media.removeEventListener("change", onChange);
    };
  }, []);

  return children;
}
