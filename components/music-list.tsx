"use client";

import { useMemo, useState } from "react";
import { SettingsButton } from "@/components/settings-button";
import {
  trackArtistName,
  trackPlatformLabel,
  trackStatsLabel,
  type Track,
  type TrackKind,
} from "@/content/tracks";
import { spotifyEmbedUrl, youtubeVideoId } from "@/lib/youtube";

const filters: Array<{ id: "all" | TrackKind; label: string }> = [
  { id: "all", label: "전체" },
  { id: "cover", label: "커버" },
  { id: "original", label: "오리지널" },
];

export function MusicList({ tracks }: { tracks: Track[] }) {
  const [kind, setKind] = useState<"all" | TrackKind>("all");
  const [playing, setPlaying] = useState<Track | null>(null);
  const rows = useMemo(
    () => (kind === "all" ? tracks : tracks.filter((track) => track.kind === kind)),
    [kind, tracks],
  );

  const youtubeId = playing ? youtubeVideoId(playing.href) : null;
  const spotify = playing ? spotifyEmbedUrl(playing.href) : null;

  return (
    <div className={playing ? "pb-56" : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight">음원</h1>
          <p className="mt-1 text-[15px] text-muted">앱 안에서 바로 들을 수 있어요</p>
        </div>
        <SettingsButton />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={kind === item.id}
            onClick={() => setKind(item.id)}
            className={`h-9 rounded-full px-4 text-sm font-medium ${
              kind === item.id ? "bg-violet text-white" : "bg-soft text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-16 text-center text-sm text-muted">아직 모은 음원이 없습니다</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((track) => {
            const artist = trackArtistName(track.memberSlug);
            const stats = trackStatsLabel(track);
            const active = playing?.id === track.id;
            const canPlay = Boolean(youtubeVideoId(track.href) || spotifyEmbedUrl(track.href));
            return (
              <li key={track.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!canPlay) {
                      window.open(track.href, "_blank", "noopener,noreferrer");
                      return;
                    }
                    setPlaying(active ? null : track);
                  }}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left ${
                    active ? "bg-soft-strong" : "bg-soft"
                  }`}
                >
                  {track.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={track.thumb}
                      alt=""
                      className="size-16 shrink-0 rounded-xl object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-medium text-violet">
                      {track.kind === "cover" ? "커버" : "오리지널"}
                      {` · ${trackPlatformLabel(track)}`}
                      {track.date ? ` · ${track.date}` : ""}
                    </span>
                    <span className="mt-1 block line-clamp-2 text-[15px] font-medium leading-5">{track.title}</span>
                    <span className="mt-1 block text-sm text-muted">{artist}</span>
                    {stats ? <span className="mt-1 block text-[12px] text-muted">{stats}</span> : null}
                  </span>
                  <span className="shrink-0 text-sm font-medium text-violet">{active ? "닫기" : canPlay ? "재생" : "열기"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {playing ? (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-50 border-t border-line bg-nav px-4 py-3 md:bottom-0">
          <div className="mx-auto max-w-md md:max-w-5xl">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="line-clamp-1 text-sm font-medium">{playing.title}</p>
                <p className="text-xs text-muted">{trackArtistName(playing.memberSlug)}</p>
              </div>
              <button type="button" onClick={() => setPlaying(null)} className="shrink-0 text-sm text-muted">
                닫기
              </button>
            </div>
            {youtubeId ? (
              <div className="overflow-hidden rounded-xl bg-black aspect-video">
                <iframe
                  title={playing.title}
                  src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`}
                  className="size-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : spotify ? (
              <iframe
                title={playing.title}
                src={spotify}
                className="h-[152px] w-full rounded-xl"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
              />
            ) : (
              <a href={playing.href} target="_blank" rel="noreferrer" className="text-sm font-medium text-violet">
                외부에서 열기
              </a>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
