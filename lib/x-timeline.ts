import type { Post } from "@/content/posts";

type Tweet = {
  id?: string;
  url?: string;
  text?: string;
  created_timestamp?: number;
  replying_to?: { screen_name?: string } | null;
  reposted_by?: unknown;
  author?: { screen_name?: string };
  media?: {
    photos?: { url?: string }[];
    videos?: { thumbnail_url?: string; url?: string; formats?: { container?: string; url?: string }[] }[];
  };
};

type YahooEntry = {
  id?: string;
  displayText?: string;
  createdAt?: number;
  screenName?: string;
  hashtags?: { text?: string }[];
  media?: { type?: string; item?: { mediaUrl?: string; thumbnailImageUrl?: string } }[];
};

export async function fetchTaggedPosts(tag: string, slug?: string, cursor?: string) {
  const { Capacitor } = await import("@capacitor/core");
  // Yahoo realtime has no browser CORS. Web uses cron-baked posts.json only.
  if (!Capacitor.isNativePlatform()) {
    return { posts: [] as Post[], cursor: undefined as string | undefined };
  }

  const start = Number(cursor) || 1;
  try {
    const data = await readYahoo(tag, start);
    const entries = data?.timeline?.entry ?? [];
    const posts = entries.flatMap((entry) => {
      const post = toYahooPost(entry, tag, slug);
      return post ? [post] : [];
    });
    const next = entries.length >= 40 && start < 1000 ? String(start + 40) : undefined;
    return { posts, cursor: next };
  } catch {
    return { posts: [] as Post[], cursor: undefined as string | undefined };
  }
}

async function readYahoo(tag: string, start: number) {
  const url = new URL("https://search.yahoo.co.jp/realtime/api/v1/pagination");
  url.searchParams.set("p", tag);
  url.searchParams.set("results", "40");
  url.searchParams.set("start", String(start));
  const { CapacitorHttp } = await import("@capacitor/core");
  const response = await CapacitorHttp.get({
    url: url.toString(),
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36",
      Referer: "https://search.yahoo.co.jp/realtime/search",
    },
  });
  if (response.status !== 200) return null;
  return response.data as { timeline?: { entry?: YahooEntry[] } };
}

function toYahooPost(entry: YahooEntry, tag: string, slug?: string): Post | null {
  if (!entry.id || !entry.createdAt) return null;
  const wanted = tag.replace(/^#/, "").toLowerCase();
  const tagged = (entry.hashtags ?? []).some((item) => item.text?.toLowerCase() === wanted);
  const title = cleanYahooText(entry.displayText ?? "");
  if (!tagged && !title.toLowerCase().includes(tag.toLowerCase())) return null;
  const text = tagged && !title.toLowerCase().includes(tag.toLowerCase()) ? `${title} ${tag}`.trim() : title;
  if (!text) return null;
  const images = (entry.media ?? [])
    .filter((media) => media.type === "image" && media.item?.mediaUrl && !media.item.mediaUrl.includes(".m3u8"))
    .map((media) => media.item?.mediaUrl)
    .filter((url): url is string => Boolean(url));
  const video = (entry.media ?? []).find((media) => media.type === "video");
  const videoPoster = video?.item?.thumbnailImageUrl;
  const stamp = Number(entry.createdAt);
  const created = new Date(stamp > 1e12 ? stamp : stamp * 1000);
  if (Number.isNaN(created.getTime())) return null;
  const createdAt = created.toISOString();
  const author = entry.screenName ?? "";
  return {
    id: String(entry.id),
    platform: "x",
    fanart: true,
    ...(slug ? { memberSlug: slug } : {}),
    ...(author ? { author } : {}),
    title: text,
    href: author ? `https://x.com/${author}/status/${entry.id}` : `https://x.com/i/status/${entry.id}`,
    date: seoulLabel(createdAt),
    createdAt,
    ...(images.length ? { images: [...new Set(images)] } : {}),
    ...(videoPoster ? { videoPoster } : {}),
  };
}

function cleanYahooText(text: string) {
  return text.replace(/\tSTART\t|\tEND\t/g, "").replace(/\s+/g, " ").trim();
}

export async function fetchTweetCount(handle: string) {
  try {
    const response = await fetchWithTimeout(new URL(`https://api.fxtwitter.com/${handle}`));
    if (!response.ok) return null;
    const data = (await response.json()) as { user?: { tweets?: number } };
    return typeof data.user?.tweets === "number" ? data.user.tweets : null;
  } catch {
    return null;
  }
}

export async function fetchOwnPosts(handle: string, slug: string, cursor?: string) {
  const url = new URL(`https://api.fxtwitter.com/2/profile/${handle}/statuses`);
  url.searchParams.set("count", "100");
  url.searchParams.set("with_replies", "1");
  if (cursor) url.searchParams.set("cursor", cursor);
  let response = await fetchWithTimeout(url);
  if (!response.ok) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    response = await fetchWithTimeout(url);
  }
  if (!response.ok) throw new Error(String(response.status));
  const data = (await response.json()) as { results?: Tweet[]; cursor?: { bottom?: string } };
  const posts = (data.results ?? []).flatMap((tweet) => {
    const post = toPost(tweet, handle, slug);
    return post ? [post] : [];
  });
  return { posts, cursor: data.cursor?.bottom };
}

async function fetchWithTimeout(url: URL) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function toPost(tweet: Tweet, handle: string, slug: string): Post | null {
  const author = tweet.author?.screen_name ?? "";
  if (tweet.reposted_by || author.toLowerCase() !== handle.toLowerCase() || !tweet.text || !tweet.id) return null;
  const createdAt = new Date(Number(tweet.created_timestamp) * 1000).toISOString();
  const images = (tweet.media?.photos ?? []).map((photo) => photo.url).filter((url): url is string => Boolean(url));
  const video = tweet.media?.videos?.[0];
  const videoPoster = video?.thumbnail_url;
  const videoUrl = mp4Url(video);
  const replyTo = tweet.replying_to?.screen_name;
  return {
    id: String(tweet.id),
    platform: "x",
    memberSlug: slug,
    title: tweet.text.replace(/\s+/g, " ").trim(),
    href: tweet.url || `https://x.com/${author}/status/${tweet.id}`,
    date: seoulLabel(createdAt),
    createdAt,
    ...(images.length ? { images } : {}),
    ...(videoPoster ? { videoPoster } : {}),
    ...(videoUrl ? { videoUrl } : {}),
    ...(replyTo ? { replyTo } : {}),
  };
}

function mp4Url(video: { url?: string; formats?: { container?: string; url?: string }[] } | undefined) {
  const files = (video?.formats ?? []).filter((format) => format.container === "mp4" && format.url);
  return files.at(-1)?.url || (video?.url?.includes(".mp4") ? video.url : undefined);
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
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${Number(value("month"))}월 ${Number(value("day"))}일 ${value("hour")}:${value("minute")}`;
}
