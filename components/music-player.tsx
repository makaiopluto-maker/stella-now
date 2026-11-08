"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useOshi } from "@/components/oshi";
import { trackArtistName, tracks, type Track } from "@/content/tracks";
import { spotifyEmbedUrl, youtubeVideoId } from "@/lib/youtube";

type MusicPlayerValue = {
  track: Track | null;
  expanded: boolean;
  play: (track: Track) => void;
  stop: () => void;
  toggleExpanded: () => void;
  playQuick: () => void;
};

const MusicPlayerContext = createContext<MusicPlayerValue | null>(null);

function canEmbed(track: Track) {
  return Boolean(youtubeVideoId(track.href) || spotifyEmbedUrl(track.href));
}

async function syncNativeMusic(playing: boolean, title: string, artist: string) {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
    const api = (
      window as Window & {
        StellaNative?: { setMusicPlaying?: (on: boolean, title: string, artist: string) => void };
      }
    ).StellaNative;
    api?.setMusicPlaying?.(playing, title, artist);
  } catch {
    // Browser / bridge unavailable.
  }
}

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const [track, setTrack] = useState<Track | null>(null);
  const [expanded, setExpanded] = useState(true);
  const { slug } = useOshi();

  const play = useCallback((next: Track) => {
    setTrack(next);
    setExpanded(true);
  }, []);

  const stop = useCallback(() => {
    setTrack(null);
    setExpanded(false);
  }, []);

  const toggleExpanded = useCallback(() => {
    setExpanded((value) => !value);
  }, []);

  const playQuick = useCallback(() => {
    const pool = tracks.filter(canEmbed);
    const preferred =
      (slug ? pool.find((item) => item.memberSlug === slug && youtubeVideoId(item.href)) : null) ||
      pool.find((item) => youtubeVideoId(item.href)) ||
      pool[0];
    if (!preferred) return;
    setTrack(preferred);
    setExpanded(false);
  }, [slug]);

  useEffect(() => {
    const title = track?.title ?? "";
    const artist = track ? trackArtistName(track.memberSlug) : "";
    void syncNativeMusic(Boolean(track), title, artist);
    if (!track || typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return () => {
        void syncNativeMusic(false, "", "");
      };
    }
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        artwork: track.thumb ? [{ src: track.thumb, sizes: "512x512", type: "image/jpeg" }] : [],
      });
      navigator.mediaSession.setActionHandler("stop", () => stop());
      navigator.mediaSession.setActionHandler("pause", () => stop());
    } catch {
      // Media Session is best-effort.
    }
    return () => {
      void syncNativeMusic(false, "", "");
    };
  }, [track, stop]);

  const value = useMemo(
    () => ({ track, expanded, play, stop, toggleExpanded, playQuick }),
    [track, expanded, play, stop, toggleExpanded, playQuick],
  );

  return (
    <MusicPlayerContext.Provider value={value}>
      {children}
      <PersistentPlayer />
      <HomeMusicLauncher />
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer() {
  const value = useContext(MusicPlayerContext);
  if (!value) throw new Error("MusicPlayerProvider missing");
  return value;
}

function PersistentPlayer() {
  const { track, expanded, stop, toggleExpanded } = useMusicPlayer();
  if (!track) return null;

  const youtubeId = youtubeVideoId(track.href);
  const spotify = spotifyEmbedUrl(track.href);

  return (
    <div
      className={
        expanded
          ? "fixed inset-x-0 z-50 border-t border-line bg-nav px-4 py-3"
          : "fixed z-[55] w-[148px] overflow-hidden rounded-2xl border border-line bg-nav shadow-lg"
      }
      style={
        expanded
          ? { bottom: "calc(3.5rem + env(safe-area-inset-bottom))" }
          : {
              right: 16,
              bottom: "calc(5.25rem + env(safe-area-inset-bottom))",
            }
      }
    >
      <div className={expanded ? "mx-auto max-w-md md:max-w-5xl" : undefined}>
        <div className={`flex items-start justify-between gap-2 ${expanded ? "mb-2" : "px-2 py-1.5"}`}>
          <div className="min-w-0">
            <p className={`truncate font-medium ${expanded ? "text-sm" : "text-[11px]"}`}>{track.title}</p>
            {expanded ? (
              <p className="text-xs text-muted">{trackArtistName(track.memberSlug)}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={toggleExpanded}
              className={`text-violet ${expanded ? "text-sm text-muted" : "text-[11px]"}`}
            >
              {expanded ? "작게" : "크게"}
            </button>
            <button
              type="button"
              onClick={stop}
              className={`text-muted ${expanded ? "text-sm" : "text-[11px]"}`}
            >
              중지
            </button>
          </div>
        </div>

        {youtubeId ? (
          <div className={`overflow-hidden bg-black ${expanded ? "aspect-video rounded-xl" : "aspect-video"}`}>
            <iframe
              key={youtubeId}
              title={track.title}
              src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0&playsinline=1`}
              className="size-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : spotify ? (
          <iframe
            key={spotify}
            title={track.title}
            src={spotify}
            className={expanded ? "h-[152px] w-full rounded-xl" : "h-[80px] w-full"}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          />
        ) : null}
      </div>
    </div>
  );
}

function HomeMusicLauncher() {
  const pathname = usePathname();
  const { track, playQuick } = useMusicPlayer();
  if (pathname !== "/" || track) return null;

  return (
    <button
      type="button"
      onClick={playQuick}
      aria-label="음악 재생"
      className="fixed z-[55] flex size-14 items-center justify-center rounded-2xl border border-line bg-nav shadow-lg"
      style={{
        right: 16,
        bottom: "calc(5.25rem + env(safe-area-inset-bottom))",
      }}
    >
      <span className="grid size-8 place-items-center rounded-full bg-violet text-white">
        <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
          <path d="M8 6.5v11l9-5.5z" />
        </svg>
      </span>
    </button>
  );
}
