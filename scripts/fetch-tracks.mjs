import { existsSync, readFileSync, writeFileSync } from "node:fs";

const outPath = new URL("../content/tracks.json", import.meta.url);
const membersSource = readFileSync(new URL("../content/members.ts", import.meta.url), "utf8");
const postsPath = new URL("../content/posts.json", import.meta.url);
// YouTube WEB innertube client key (public client id, not a private Data API secret).
const ytKey = process.env.YT_INNERTUBE_KEY || "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

const previous = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : [];
const kept = new Map(previous.map((track) => [track.id, track]));

const channels = [
  ...[...membersSource.matchAll(/slug: "([^"]+)"[\s\S]*?youtube: "([^"]+)"/g)].map(([, slug, youtube]) => ({
    slug,
    youtube,
  })),
  { slug: "stellive", youtube: "https://www.youtube.com/@stellive_official" },
];

const next = new Map();

for (const channel of channels) {
  try {
    const channelId = await resolveChannelId(channel.youtube);
    if (!channelId) throw new Error("no channel id");
    const fromRss = await fetchRss(channelId, channel.slug);
    const fromBrowse = await fetchBrowse(channelId, channel.slug);
    for (const track of [...fromRss, ...fromBrowse]) remember(track);
    console.log(`${channel.slug}: rss ${fromRss.length}, browse ${fromBrowse.length}`);
  } catch (error) {
    console.warn(`tracks failed for ${channel.slug}: ${error instanceof Error ? error.message : error}`);
  }
  await sleep(350);
}

if (existsSync(postsPath)) {
  try {
    const posts = JSON.parse(readFileSync(postsPath, "utf8"));
    let added = 0;
    for (const post of posts) {
      if (post.platform !== "x" || post.fanart || !post.memberSlug) continue;
      const id = youtubeId(post.title) || youtubeId(post.href);
      if (!id || next.has(id) || kept.has(id)) continue;
      if (!isMusicTitle(post.title) || isNoiseTitle(post.title)) continue;
      remember({
        id,
        title: cleanTitle(post.title),
        memberSlug: post.memberSlug,
        kind: classify(post.title),
        href: `https://www.youtube.com/watch?v=${id}`,
        thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        date: post.date,
        createdAt: post.createdAt,
      });
      added += 1;
    }
    console.log(`posts: ${added}`);
  } catch (error) {
    console.warn(`posts scan failed: ${error instanceof Error ? error.message : error}`);
  }
}

for (const track of kept.values()) {
  if (next.has(track.id)) continue;
  if (track.platform === "spotify") {
    next.set(track.id, track);
    continue;
  }
  if (isMusicTitle(track.title) && !isNoiseTitle(track.title)) next.set(track.id, track);
}

const youtubeIds = [...next.values()]
  .filter((track) => track.platform !== "spotify")
  .map((track) => track.id);
let statsOk = 0;
for (const id of youtubeIds) {
  const stats = await fetchVideoStats(id);
  if (!stats) continue;
  const prev = next.get(id);
  if (!prev) continue;
  next.set(id, {
    ...prev,
    viewCount: stats.viewCount ?? prev.viewCount ?? null,
    likeCount: stats.likeCount ?? prev.likeCount ?? null,
  });
  statsOk += 1;
  await sleep(120);
}
console.log(`youtube stats: ${statsOk}/${youtubeIds.length}`);

const rows = [...next.values()].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
if (rows.length === 0 && previous.length > 0) {
  writeFileSync(outPath, `${JSON.stringify(previous, null, 2)}\n`);
  console.warn(`tracks unchanged: ${previous.length}`);
} else {
  writeFileSync(outPath, `${JSON.stringify(rows, null, 2)}\n`);
  console.log(`tracks: ${rows.length}`);
}

function remember(track) {
  if (!track?.id || !track.title) return;
  if (!isMusicTitle(track.title) || isNoiseTitle(track.title)) return;
  const prev = kept.get(track.id) || next.get(track.id);
  if (prev?.platform === "spotify") return;
  const title = preferTitle(cleanTitle(track.title), prev?.title);
  const createdAt = preferCreated(track.createdAt, prev?.createdAt);
  const memberSlug = preferMember(track.memberSlug, prev?.memberSlug, title);
  next.set(track.id, {
    id: track.id,
    title,
    memberSlug,
    kind: classify(title),
    platform: "youtube",
    href: track.href || prev?.href || `https://www.youtube.com/watch?v=${track.id}`,
    thumb: track.thumb || prev?.thumb || `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`,
    date: createdAt ? seoulDateLabel(createdAt) : track.date || prev?.date || "",
    createdAt,
    viewCount: track.viewCount ?? prev?.viewCount ?? null,
    likeCount: track.likeCount ?? prev?.likeCount ?? null,
  });
}

async function fetchVideoStats(videoId) {
  try {
    const response = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${ytKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "WEB",
            clientVersion: "2.20241126.01.00",
            hl: "ko",
            gl: "KR",
          },
        },
        videoId,
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const micro = data.microformat?.playerMicroformatRenderer;
    const viewCount = Number(data.videoDetails?.viewCount ?? micro?.viewCount);
    const likeCount = Number(micro?.likeCount);
    return {
      viewCount: Number.isFinite(viewCount) ? viewCount : null,
      likeCount: Number.isFinite(likeCount) ? likeCount : null,
    };
  } catch {
    return null;
  }
}

async function resolveChannelId(youtube) {
  const direct = youtube.match(/channel\/(UC[\w-]+)/);
  if (direct) return direct[1];
  const response = await fetch(youtube, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
  });
  if (!response.ok) throw new Error(String(response.status));
  const html = await response.text();
  return (
    html.match(/rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]+)"/)?.[1] ||
    html.match(/"externalId":"(UC[^"]+)"/)?.[1] ||
    null
  );
}

async function fetchRss(channelId, memberSlug) {
  const response = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
    headers: { "User-Agent": "StellaNow/1.0", Accept: "application/atom+xml" },
  });
  if (!response.ok) throw new Error(`rss ${response.status}`);
  const xml = await response.text();
  const entries = xml.split("<entry>").slice(1);
  return entries.flatMap((entry) => {
    const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const title = decodeXml(entry.match(/<media:title>([^<]+)<\/media:title>/)?.[1] || "");
    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1] || null;
    if (!id || !title) return [];
    return [
      {
        id,
        title,
        memberSlug,
        kind: classify(title),
        href: `https://www.youtube.com/watch?v=${id}`,
        thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        date: seoulDateLabel(published),
        createdAt: published,
      },
    ];
  });
}

async function fetchBrowse(channelId, memberSlug) {
  const response = await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${ytKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "WEB",
          clientVersion: "2.20241126.01.00",
          hl: "ko",
          gl: "KR",
        },
      },
      browseId: channelId,
      params: "EgZ2aWRlb3PyBgQKAjoA",
    }),
  });
  if (!response.ok) throw new Error(`browse ${response.status}`);
  const data = await response.json();
  const found = [];
  walk(data, found);
  return found.map((item) => ({
    id: item.id,
    title: item.title,
    memberSlug,
    kind: classify(item.title),
    href: `https://www.youtube.com/watch?v=${item.id}`,
    thumb: `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
    date: item.date || "",
    createdAt: item.createdAt || null,
  }));
}

function walk(node, out) {
  if (!node || typeof node !== "object") return;
  const lockup = node.lockupViewModel;
  const meta = node.lockupMetadataViewModel || lockup?.metadata?.lockupMetadataViewModel;
  if (lockup?.contentId && meta?.title?.content) {
    out.push({
      id: lockup.contentId,
      title: meta.title.content,
      date: relativeToLabel(meta.metadata?.contentMetadataViewModel?.metadataRows),
      createdAt: null,
    });
  }
  const video = node.videoRenderer;
  if (video?.videoId) {
    const title = video.title?.runs?.map((part) => part.text).join("") || video.title?.simpleText || "";
    if (title) out.push({ id: video.videoId, title, date: seoulDateLabel(), createdAt: null });
  }
  for (const value of Object.values(node)) walk(value, out);
}

function isMusicTitle(title) {
  return /(?:【\s*)?(?:cover|COVER)(?:\s*】)?|커버\s*곡|커버|歌ってみた|オリジナル|original\s*song|official\s*(?:mv|audio|music)|뮤직\s*비디오|(?:^|[^가-힣])뮤비(?:[^가-힣]|$)|음원\s*발매|music\s*video|1st\s*(?:single|ep)|단체\s*커버|오리지널|데뷔\s*곡|theme\s*song|오리지널\s*곡/i.test(
    title,
  );
}

function isNoiseTitle(title) {
  if (/\|\s*\d{4}\.\d{2}\.\d{2}\s*\]/.test(title)) return true;
  return /핫클립|hot\s*clip|하이라이트|highlight|합방|작업\s*방송|월드컵|마인크래프트|로블록스|리그\s*오브|콜\s*오브\s*듀티|shorts|티저(?![^\n]*cover)/i.test(
    title,
  );
}

function classify(title) {
  if (/(?:【\s*)?(?:cover|COVER)(?:\s*】)?|커버|歌ってみた/i.test(title)) return "cover";
  return "original";
}

function preferTitle(incoming, previous) {
  if (!previous) return incoming;
  if (!incoming) return previous;
  return titleScore(incoming) >= titleScore(previous) ? incoming : previous;
}

function titleScore(title) {
  let score = title.length;
  if (/(?:cover|커버|歌ってみた|original|오리지널|official\s*mv)/i.test(title)) score += 80;
  if (/https?:\/\//i.test(title)) score -= 60;
  if (/💜|🌟|잡숴|한번|응원|헤헤|ㅋㅋ/.test(title)) score -= 40;
  if (/\/\s*.+\s*cover/i.test(title) || /Cover\s*$/i.test(title)) score += 40;
  return score;
}

function preferCreated(incoming, previous) {
  if (incoming && previous) return incoming < previous ? incoming : previous;
  return incoming || previous || null;
}

function preferMember(incoming, previous, title) {
  if (/(스텔라이브|STELLIVE).{0,20}cover|단체\s*커버/i.test(title) && !/\b(x|×)\b/i.test(title)) {
    return "stellive";
  }
  if (incoming && incoming !== "stellive") return incoming;
  if (previous && previous !== "stellive") return previous;
  return incoming || previous || "stellive";
}

function cleanTitle(title) {
  return title
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function youtubeId(value) {
  if (!value) return null;
  return (
    value.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|live\/|embed\/))([A-Za-z0-9_-]{11})/)?.[1] || null
  );
}

function seoulDateLabel(iso) {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${month}월 ${day}일`;
}

function relativeToLabel(rows) {
  const text = rows?.[0]?.metadataParts?.map((part) => part.text?.content).filter(Boolean).join(" ") || "";
  if (!text) return "";
  if (/시간\s*전|분\s*전|초\s*전|어제/.test(text)) return seoulDateLabel();
  const days = text.match(/(\d+)\s*일\s*전/);
  if (days) {
    const date = new Date();
    date.setDate(date.getDate() - Number(days[1]));
    return seoulDateLabel(date.toISOString());
  }
  return "";
}

function decodeXml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
