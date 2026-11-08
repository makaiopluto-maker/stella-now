"use client";

const key = "stella-now-theme";
const listeners = new Set<() => void>();

export type ThemeMode = "light" | "dark" | "system";

function emit() {
  listeners.forEach((listener) => listener());
}

export function readTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const value = window.localStorage.getItem(key);
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export function writeTheme(mode: ThemeMode) {
  window.localStorage.setItem(key, mode);
  applyTheme(mode);
  emit();
}

export function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resolvedDark(mode: ThemeMode = readTheme()) {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(mode: ThemeMode = readTheme()) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolvedDark(mode));
}
