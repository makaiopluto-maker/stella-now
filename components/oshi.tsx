"use client";

import { useEffect, useSyncExternalStore } from "react";
import { syncNativeOshi } from "@/lib/native-bridge";

const KEY = "stella-now-oshi";
const ALERT_KEY = "stella-now-oshi-alert";
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function storedSlug() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

function storedAlert() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(ALERT_KEY) === "1";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return `${storedSlug() ?? ""}\u0000${storedAlert() ? "1" : "0"}`;
}

function getServerSnapshot() {
  return "\u00000";
}

export function useOshi() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const split = snapshot.indexOf("\u0000");
  const slug = snapshot.slice(0, split) || null;
  const alert = snapshot.slice(split + 1) === "1";

  function choose(next: string) {
    window.localStorage.setItem(KEY, next);
    emit();
    void syncNativeOshi(next, storedAlert());
  }

  function clear() {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(ALERT_KEY);
    emit();
    void syncNativeOshi(null, false);
  }

  async function setAlerts(on: boolean) {
    if (!on) {
      window.localStorage.removeItem(ALERT_KEY);
      emit();
      void syncNativeOshi(storedSlug(), false);
      return;
    }
    if (!storedSlug()) return;
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        // The in-app notice still works when the device blocks notifications.
      }
    }
    window.localStorage.setItem(ALERT_KEY, "1");
    emit();
    void syncNativeOshi(storedSlug(), true);
  }

  useEffect(() => {
    void syncNativeOshi(slug, alert);
  }, [slug, alert]);

  return { slug, alert, choose, clear, setAlerts };
}
