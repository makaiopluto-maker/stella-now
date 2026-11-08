"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink } from "@/components/external-link";
import { appDownload } from "@/content/app-download";
import {
  dismissUpdateVersion,
  fetchLatestAppVersion,
  installedAppVersion,
  isNewerVersion,
  readDismissedVersion,
} from "@/lib/app-update";

type UpdateInfo = {
  version: string;
  href: string;
};

export function AppUpdateAlert() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  const check = useCallback(async (force = false) => {
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;

      const latest = await fetchLatestAppVersion();
      if (!latest?.version) return;

      const current = await installedAppVersion();
      if (!isNewerVersion(latest.version, current)) {
        setUpdate(null);
        return;
      }
      if (!force && readDismissedVersion() === latest.version) return;

      setUpdate({
        version: latest.version,
        href: latest.apk || appDownload.href,
      });
    } catch {
      // Offline / rate-limit: skip quietly.
    }
  }, []);

  useEffect(() => {
    let stop = false;
    const run = () => {
      if (!stop) void check(false);
    };
    run();
    const timer = window.setInterval(run, 30 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      stop = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [check]);

  if (!update) return null;

  return (
    <div className="fixed inset-x-4 top-4 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-lg">
      <div className="min-w-0 flex-1">
        <span className="block text-sm font-medium">새 버전 {update.version}이 있어요</span>
        <span className="mt-0.5 block text-xs text-white/70">지금 앱을 업데이트하세요</span>
      </div>
      <ExternalLink
        href={update.href}
        className="shrink-0 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-ink"
      >
        업데이트
      </ExternalLink>
      <button
        type="button"
        onClick={() => {
          dismissUpdateVersion(update.version);
          setUpdate(null);
        }}
        className="shrink-0 text-sm text-white/80"
      >
        닫기
      </button>
    </div>
  );
}
