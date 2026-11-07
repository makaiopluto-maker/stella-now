"use client";

const listeners = new Map<string, Set<() => void>>();

export function readFlag(key: string) {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(key) === "1";
}

export function writeFlag(key: string, on: boolean) {
  if (on) window.localStorage.setItem(key, "1");
  else window.localStorage.removeItem(key);
  emit(key);
}

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
  emit(key);
}

export function subscribePref(key: string, listener: () => void) {
  const set = listeners.get(key) ?? new Set();
  set.add(listener);
  listeners.set(key, set);
  return () => {
    set.delete(listener);
  };
}

function emit(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
}
