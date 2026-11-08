import type { Post } from "@/content/posts";
import { members } from "@/content/members";
import { withBasePath } from "@/lib/base-path";

type CafeArticle = {
  articleId?: number;
  subject?: string;
  openArticle?: boolean;
  blindArticle?: boolean;
  replyArticle?: boolean;
  writeDateTimestamp?: number;
  representImage?: string;
};

const cafeApi = "https://apis.naver.com/cafe-web/cafe2/ArticleListV2dot1.json";

export async function fetchCafeNoticePage(page: number) {
  const params = new URLSearchParams({
    "search.clubid": "29424353",
    "search.menuid": "130",
    "search.page": String(page),
    "search.perPage": "50",
  });
  const payload = await readJson(`${cafeApi}?${params}`, "/cafe-notices");
  const result = payload?.message?.result as { articleList?: CafeArticle[]; hasNext?: boolean } | undefined;
  const articles = result?.articleList ?? [];
  const posts = articles.flatMap((article) => {
    const post = toCafeNotice(article);
    return post ? [post] : [];
  });
  return { posts, hasNext: Boolean(result?.hasNext) && articles.length > 0 };
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
  // Static GitHub Pages has no cafe proxy — rely on baked posts.json.
  if (process.env.NODE_ENV === "production") {
    return { message: { result: { articleList: [], hasNext: false } } };
  }
  const url = new URL(withBasePath(localPath), window.location.origin);
  url.search = new URL(remote).search;
  const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

function toCafeNotice(article: CafeArticle): Post | null {
  if (!article.articleId || article.openArticle === false || article.blindArticle || article.replyArticle) return null;
  const title = decodeHtml(String(article.subject ?? "")).replace(/\s+/g, " ").trim();
  const created = new Date(Number(article.writeDateTimestamp));
  if (!title || Number.isNaN(created.getTime())) return null;
  const createdAt = created.toISOString();
  const hits = members.filter((member) => title.includes(member.name));
  const image = cafeImage(article.representImage);
  return {
    id: `cafe-${article.articleId}`,
    platform: "cafe",
    ...(hits.length === 1 ? { memberSlug: hits[0].slug } : {}),
    title,
    href: `https://cafe.naver.com/tteokbokk1/${article.articleId}`,
    date: seoulLabel(createdAt),
    createdAt,
    ...(image ? { images: [image] } : {}),
  };
}

function decodeHtml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function cafeImage(url?: string) {
  if (!url || url.includes(".m3u8")) return undefined;
  return url.replace(/type=f\d+_\d+/, "type=w800");
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
