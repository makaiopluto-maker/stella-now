import { appDownload } from "@/content/app-download";
import { siteBasePath } from "@/lib/base-path";

export type AppVersionManifest = {
  version: string;
  apk?: string;
  releases?: string;
};

const dismissKey = "stella-now-update-dismissed";

export function installedAppVersion() {
  return appDownload.version;
}

/** Return true when `remote` is a newer semver than `local`. */
export function isNewerVersion(remote: string, local: string) {
  const a = parseSemver(remote);
  const b = parseSemver(local);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
}

export function readDismissedVersion() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(dismissKey) || "";
}

export function dismissUpdateVersion(version: string) {
  window.localStorage.setItem(dismissKey, version);
}

export async function fetchLatestAppVersion(): Promise<AppVersionManifest | null> {
  const urls = [
    appDownload.versionManifestHref,
    `${siteBasePath()}/app-version.json`,
    "https://stellanow.kro.kr/app-version.json",
  ];

  for (const url of urls) {
    try {
      const data = await getJson(url);
      if (data?.version) return data;
    } catch {
      // Try the next source.
    }
  }
  return null;
}

function parseSemver(value: string) {
  const match = value.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])] as const;
}

async function getJson(url: string): Promise<AppVersionManifest | null> {
  try {
    const { Capacitor, CapacitorHttp } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const response = await CapacitorHttp.get({
        url,
        headers: { Accept: "application/json" },
      });
      if (response.status < 200 || response.status >= 300) return null;
      const data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
      return data && typeof data.version === "string" ? data : null;
    }
  } catch {
    // Fall through to fetch.
  }

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;
  const data = (await response.json()) as AppVersionManifest;
  return data && typeof data.version === "string" ? data : null;
}
