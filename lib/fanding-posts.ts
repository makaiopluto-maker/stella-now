import type { Post } from "@/content/posts";
import { members } from "@/content/members";
import { withBasePath } from "@/lib/base-path";

type FandingPost = {
  iPostNo?: number;
  sTitle?: string;
  sInsDatetime?: string;
  sPostThumbnailUrl?: string;
  aAuthInfo?: { bIsLock?: boolean };
};

const fandingApi = "https://fanding.kr/rest/post_list";

export async function fetchFandingPage(cursor?: string) {
  const params = new URLSearchParams({
    sMemberUrl: "stellive",
    iLimit: "20",
    sSortOrder: "recent",
    sVisibleOnlyOption: "F",
  });
  if (cursor) params.set("iLastPostNo", cursor);
  const payload = await readJson(`${fandingApi}?${params}`, "/fanding-posts");
  const data = payload?.aData as { aPostList?: FandingPost[]; iLastPostNo?: number } | undefined;
  const list = data?.aPostList ?? [];
  const posts = list.flatMap((post) => {
    const item = toFandingPost(post);
    return item ? [item] : [];
  });
  const nextRaw = data?.iLastPostNo;
  const next = nextRaw && String(nextRaw) !== cursor && list.length >= 20 ? String(nextRaw) : null;
  return { posts, next };
}

async function readJson(remote: string, localPath: string) {
  const { Capacitor, CapacitorHttp } = await import("@capacitor/core");
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({
      url: remote,
      headers: { Accept: "application/json", "User-Agent": "StellaNow/1.0" },
    });
    if (response.status < 200 || response.status >= 300) throw new Error(String(response.status));
    return typeof response.data === "string" ? JSON.parse(response.data) : response.data;
  }
  // Static GitHub Pages has no fanding proxy — rely on baked posts.json.
  if (process.env.NODE_ENV === "production") throw new Error("fanding proxy unavailable");
  const url = new URL(withBasePath(localPath), window.location.origin);
  url.search = new URL(remote).search;
  const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

function toFandingPost(post: FandingPost): Post | null {
  if (!post.iPostNo || post.aAuthInfo?.bIsLock || !post.sTitle || !post.sInsDatetime) return null;
  const createdAt = new Date(`${post.sInsDatetime.replace(" ", "T")}+09:00`).toISOString();
  if (Number.isNaN(new Date(createdAt).getTime())) return null;
  const title = post.sTitle.replace(/\s+/g, " ").trim();
  if (!title) return null;
  const hits = members.filter((member) => title.includes(member.name));
  const image = post.sPostThumbnailUrl && !post.sPostThumbnailUrl.includes(".m3u8") ? post.sPostThumbnailUrl : undefined;
  return {
    id: `fanding-${post.iPostNo}`,
    platform: "fanding",
    ...(hits.length === 1 ? { memberSlug: hits[0].slug } : {}),
    title,
    href: `https://fanding.kr/@stellive/post/${post.iPostNo}`,
    date: seoulLabel(createdAt),
    createdAt,
    ...(image ? { images: [image] } : {}),
  };
}

function seoulLabel(iso: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${Number(value("month"))}월 ${Number(value("day"))}일 ${value("hour")}:${value("minute")}`;
}
