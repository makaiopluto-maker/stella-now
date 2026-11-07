"use client";

import { posts } from "@/content/posts";
import { readJson, subscribePref, writeJson } from "@/lib/prefs";

const key = "stella-now-notice-seen";

type Seen = { cafe?: string; fanding?: string };

export function latestNoticeTimes() {
  const cafe = newest("cafe");
  const fanding = newest("fanding");
  return { cafe, fanding };
}

export function hasNewNotices() {
  const seen = readJson<Seen>(key, {});
  const latest = latestNoticeTimes();
  return Boolean((latest.cafe && latest.cafe !== seen.cafe) || (latest.fanding && latest.fanding !== seen.fanding));
}

export function markNoticesSeen() {
  writeJson(key, latestNoticeTimes());
}

export function subscribeNoticeBadge(listener: () => void) {
  return subscribePref(key, listener);
}

function newest(platform: "cafe" | "fanding") {
  return posts
    .filter((post) => post.platform === platform)
    .map((post) => post.createdAt)
    .sort()
    .at(-1);
}
