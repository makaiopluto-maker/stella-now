import { getGraduate, getMember } from "@/content/members";
import data from "@/content/tracks.json";

export type TrackKind = "cover" | "original";
export type TrackPlatform = "youtube" | "spotify";

export type Track = {
  id: string;
  title: string;
  memberSlug: string;
  kind: TrackKind;
  platform?: TrackPlatform;
  href: string;
  thumb?: string;
  date: string;
  createdAt?: string | null;
  viewCount?: number | null;
  likeCount?: number | null;
};

export const tracks = data as Track[];

export function trackArtistName(slug: string, fallback?: string) {
  if (slug === "stellive") return "스텔라이브";
  return fallback ?? getMember(slug)?.name ?? getGraduate(slug)?.name ?? slug;
}

export function trackPlatformLabel(track: Track) {
  if (track.platform === "spotify") return "스포티파이";
  return "유튜브";
}

export function formatTrackCount(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "";
  if (value >= 100_000_000) return `${trimCount(value / 100_000_000)}억`;
  if (value >= 10_000) return `${trimCount(value / 10_000)}만`;
  return Math.round(value).toLocaleString("ko-KR");
}

export function trackStatsLabel(track: Track) {
  if (track.platform === "spotify") return "";
  const views = formatTrackCount(track.viewCount);
  const likes = formatTrackCount(track.likeCount);
  if (!views && !likes) return "";
  if (views && likes) return `조회 ${views} · 좋아요 ${likes}`;
  if (views) return `조회 ${views}`;
  return `좋아요 ${likes}`;
}

function trimCount(value: number) {
  return value.toFixed(value >= 10 ? 0 : 1).replace(/\.0$/, "");
}
