import { existsSync, readFileSync, writeFileSync } from "node:fs";

const outPath = new URL("../content/tracks.json", import.meta.url);
const artistsPath = new URL("../content/spotify-artists.json", import.meta.url);
const artists = JSON.parse(readFileSync(artistsPath, "utf8"));
const artistById = new Map(artists.map((artist) => [artist.id, artist]));

// Group / known album seeds so new album cuts still appear even before they hit popular.
const seedAlbums = [
  "2LblDJO0mG76a8OFinkJMZ", // STAR TRAIL
  "3ew97z65IXzEshDZaJLo74", // Colorful Strokes
  "6M6Cq2lvCoSvkPSywYjFQP", // 별이 시작되는 곳
  "6gKG08rLPHtmZs2fHdrj0X", // 유성우
  "0P5zt1bkjAX1nUhOUn8k02", // Milky Way
  "6QrzmghYca98QAfk0uog6r", // Stars Align
  "0TMYH8SkTsDsrHKyJArml4", // 마음악보
  "1q4qe6gcA06ey0hzmWhYZv", // Our Tales
];

const artistMap = [
  [/스텔라이브|stellive/i, "stellive"],
  [/ayatsuno\s*yuni|아야츠노\s*유니/i, "yuni"],
  [/sakihane\s*huya|사키하네\s*후야/i, "huya"],
  [/shirayuki\s*hina|시라유키\s*히나/i, "hina"],
  [/neneko\s*mashiro|네네코\s*마시로/i, "mashiro"],
  [/akane\s*lize|아카네\s*리제/i, "lize"],
  [/arahashi\s*tabi|아라하시\s*타비/i, "tabi"],
  [/tenko\s*shibuki|텐코\s*시부키/i, "shibuki"],
  [/aokumo\s*rin|아오쿠모\s*린/i, "rin"],
  [/hanako\s*nana|하나코\s*나나/i, "nana"],
  [/yuzuha\s*riko|유즈하\s*리코/i, "riko"],
  [/shizuki\s*toa|시즈키\s*토아/i, "toa"],
  [/cogane\s*rang|코가네\s*랑/i, "rang"],
  [/hanayo\s*hiyori|하나요\s*히요리/i, "hiyori"],
  [/tokino\s*mary|토키노\s*메리/i, "mary"],
  [/airi\s*kanna|아이리\s*칸나/i, "kanna"],
];

const previous = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : [];
const next = new Map(previous.map((track) => [track.id, track]));
const pendingTrackIds = new Set();

try {
  for (const artist of artists) {
    const entity = await embedEntity("artist", artist.id);
    const list = entity?.trackList || [];
    console.log(`spotify artist ${artist.name}: ${list.length}`);
    for (const item of list) {
      const trackId = String(item.uri || "").replace("spotify:track:", "");
      if (!trackId || isInstrumental(item.title)) continue;
      pendingTrackIds.add(trackId);
      rememberSpotify(item, null, null, artist.slug);
    }
    await sleep(250);
  }

  for (const albumId of seedAlbums) {
    const album = await embedEntity("album", albumId);
    if (!album) continue;
    const cover = album.visualIdentity?.image?.[0]?.url || null;
    const release = album.releaseDate?.isoString || null;
    let count = 0;
    for (const item of album.trackList || []) {
      const trackId = String(item.uri || "").replace("spotify:track:", "");
      if (trackId) pendingTrackIds.add(trackId);
      if (rememberSpotify(item, cover, release)) count += 1;
    }
    console.log(`spotify album ${album.name || album.title || albumId}: ${count}`);
    await sleep(300);
  }

  let enriched = 0;
  for (const trackId of pendingTrackIds) {
    const entity = await embedEntity("track", trackId);
    if (!entity) continue;
    const cover = entity.visualIdentity?.image?.[0]?.url || null;
    const release = entity.releaseDate?.isoString || null;
    if (rememberSpotify(entity, cover, release)) enriched += 1;
    await sleep(180);
  }
  console.log(`spotify enriched: ${enriched}`);
  console.log(`spotify saved: ${[...next.values()].filter((track) => track.platform === "spotify").length}`);
} catch (error) {
  console.warn(`spotify failed: ${error instanceof Error ? error.message : error}`);
}

for (const [id, track] of [...next.entries()]) {
  if (track.platform === "spotify" && isInstrumental(track.title)) next.delete(id);
}

const deduped = new Map();
for (const track of next.values()) {
  if (track.platform !== "spotify") {
    deduped.set(track.id, track);
    continue;
  }
  const key = `spotify|${track.memberSlug}|${normalizeTitle(track.title)}`;
  const prev = deduped.get(key);
  if (!prev || (track.thumb && !prev.thumb) || (track.createdAt && !prev.createdAt)) deduped.set(key, track);
}

const rows = [...deduped.values()].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
writeFileSync(outPath, `${JSON.stringify(rows, null, 2)}\n`);
console.log(`tracks: ${rows.length}`);

async function embedEntity(kind, id) {
  const response = await fetch(`https://open.spotify.com/embed/${kind}/${id}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
  });
  if (!response.ok) throw new Error(`embed ${kind} ${response.status}`);
  const html = await response.text();
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error(`embed ${kind} missing data`);
  return JSON.parse(match[1])?.props?.pageProps?.state?.data?.entity || null;
}

function rememberSpotify(item, cover, release, fallbackSlug = null) {
  const id = String(item.uri || item.id || "").replace("spotify:track:", "");
  const title = String(item.title || item.name || "").trim();
  if (!id || !title || isInstrumental(title)) return false;
  const memberSlug = mapArtists(item.artists, item.subtitle || item.name) || fallbackSlug || "stellive";
  const prev = next.get(id);
  const createdAt = release || item.releaseDate?.isoString || prev?.createdAt || null;
  next.set(id, {
    id,
    title,
    memberSlug,
    kind: "original",
    platform: "spotify",
    href: `https://open.spotify.com/track/${id}`,
    thumb: cover || prev?.thumb || undefined,
    date: createdAt ? seoulDateLabel(createdAt) : prev?.date || "",
    createdAt,
  });
  return true;
}

function mapArtists(artists, label) {
  if (Array.isArray(artists)) {
    for (const artist of artists) {
      const id = String(artist.uri || "").replace("spotify:artist:", "");
      const known = artistById.get(id);
      if (known) return known.slug;
      const mapped = mapArtistLabel(artist.name);
      if (mapped !== "stellive" || /stellive/i.test(artist.name || "")) return mapped;
    }
  }
  return mapArtistLabel(label);
}

function mapArtistLabel(label) {
  const text = String(label || "").trim();
  for (const [pattern, slug] of artistMap) {
    if (pattern.test(text)) return slug;
  }
  return "stellive";
}

function isInstrumental(title) {
  return /\(\s*inst\.?\s*\)|\s[-–—]\s*inst\.?\b|\binstrumental\b|반주/i.test(title);
}

function normalizeTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function seoulDateLabel(iso) {
  const date = new Date(iso);
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
