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

const filters: Array<{ id: "all" | TrackKind; label: string }> = [
  { id: "all", label: "전체" },
  { id: "cover", label: "커버" },
  { id: "original", label: "오리지널" },
];

export function MusicList({ tracks }: { tracks: Track[] }) {
  const [kind, setKind] = useState<"all" | TrackKind>("all");
  const rows = useMemo(
    () => (kind === "all" ? tracks : tracks.filter((track) => track.kind === kind)),
    [kind, tracks],
  );

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight">음원</h1>
          <p className="mt-1 text-[15px] text-muted">커버는 유튜브, 오리지널은 스포티파이에서 이어집니다</p>
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
              kind === item.id ? "bg-violet text-white" : "bg-[#f2f3f7] text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-16 text-center text-sm text-[#b0b4be]">아직 모은 음원이 없습니다</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((track) => {
            const artist = trackArtistName(track.memberSlug);
            const stats = trackStatsLabel(track);
            return (
              <li key={track.id}>
                <a
                  href={track.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-2xl bg-[#f2f3f7] px-3 py-3"
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
                    {stats ? <span className="mt-1 block text-[12px] text-[#8b90a0]">{stats}</span> : null}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
