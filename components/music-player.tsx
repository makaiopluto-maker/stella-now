"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useOshi } from "@/components/oshi";
import { trackArtistName, tracks, type Track } from "@/content/tracks";
import { loadYouTubeApi, type YtPlayer } from "@/lib/youtube-api";
import { spotifyEmbedUrl, youtubeVideoId } from "@/lib/youtube";

type MusicPlayerValue = {
  track: Track | null;
  expanded: boolean;
  playing: boolean;
  play: (track: Track) => void;
  stop: () => void;
  toggleExpanded: () => void;
  togglePlay: () => void;
  playQuick: () => void;
  playNext: () => void;
  playPrev: () => void;
};

type Snapshot = {
  trackId: string | null;
  playing: boolean;
  expanded: boolean;
};

const MusicPlayerContext = createContext<MusicPlayerValue | null>(null);
const STORAGE_KEY = "stellanow-music-player-v1";

/** Survives layout remounts during static-export tab navigations. */
let memory: Snapshot = { trackId: null, playing: false, expanded: false };

function canPlayTrack(track: Track) {
  return Boolean(youtubeVideoId(track.href));
}

function playableTracks() {
  return tracks.filter(canPlayTrack);
}

function readSnapshot(): Snapshot {
  if (typeof window === "undefined") return memory;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Snapshot;
      memory = {
        trackId: typeof parsed.trackId === "string" ? parsed.trackId : null,
        playing: Boolean(parsed.playing),
        expanded: Boolean(parsed.expanded),
      };
    }
  } catch {
    // Ignore bad storage.
  }
  return memory;
}

function writeSnapshot(next: Snapshot) {
  memory = next;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode / quota.
  }
}

function trackById(id: string | null) {
  if (!id) return null;
  return tracks.find((item) => item.id === id) ?? null;
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
  const initial = readSnapshot();
  const [track, setTrack] = useState<Track | null>(() => trackById(initial.trackId));
  const [expanded, setExpanded] = useState(() => Boolean(initial.trackId) && initial.expanded);
  const [playing, setPlaying] = useState(() => Boolean(initial.trackId) && initial.playing);
  const { slug } = useOshi();
  const playerRef = useRef<YtPlayer | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<Track | null>(track);
  const playingRef = useRef(playing);
  const skipAutoRef = useRef<(delta: number) => void>(() => {});

  useEffect(() => {
    trackRef.current = track;
  }, [track]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    writeSnapshot({
      trackId: track?.id ?? null,
      playing: Boolean(track) && playing,
      expanded: Boolean(track) && expanded,
    });
  }, [track, playing, expanded]);

  const destroyPlayer = useCallback(() => {
    try {
      playerRef.current?.destroy();
    } catch {
      // Ignore destroy races.
    }
    playerRef.current = null;
    if (hostRef.current) hostRef.current.innerHTML = "";
  }, []);

  const stop = useCallback(() => {
    destroyPlayer();
    trackRef.current = null;
    setTrack(null);
    setPlaying(false);
    setExpanded(false);
    writeSnapshot({ trackId: null, playing: false, expanded: false });
    void syncNativeMusic(false, "", "");
  }, [destroyPlayer]);

  const play = useCallback((next: Track) => {
    trackRef.current = next;
    setTrack(next);
    setExpanded(true);
    setPlaying(true);
  }, []);

  const skipBy = useCallback(
    (delta: number) => {
      const pool = playableTracks();
      if (pool.length === 0) return;
      const currentId = trackRef.current?.id;
      const index = currentId ? pool.findIndex((item) => item.id === currentId) : -1;
      const nextIndex = index < 0 ? 0 : (index + delta + pool.length) % pool.length;
      const next = pool[nextIndex];
      if (!next) return;
      trackRef.current = next;
      setTrack(next);
      setPlaying(true);
    },
    [],
  );

  skipAutoRef.current = skipBy;

  const playNext = useCallback(() => skipBy(1), [skipBy]);
  const playPrev = useCallback(() => skipBy(-1), [skipBy]);

  const toggleExpanded = useCallback(() => {
    setExpanded((value) => !value);
  }, []);

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) {
      setPlaying((value) => !value);
      return;
    }
    try {
      const state = player.getPlayerState();
      // 1 = playing, 3 = buffering
      if (state === 1 || state === 3) {
        player.pauseVideo();
        setPlaying(false);
        const current = trackRef.current;
        void syncNativeMusic(false, current?.title ?? "", trackArtistName(current?.memberSlug ?? ""));
      } else {
        player.playVideo();
        setPlaying(true);
        const current = trackRef.current;
        if (current) {
          void syncNativeMusic(true, current.title, trackArtistName(current.memberSlug));
        }
      }
    } catch {
      setPlaying((value) => !value);
    }
  }, []);

  const playQuick = useCallback(() => {
    const pool = playableTracks();
    const preferred =
      (slug ? pool.find((item) => item.memberSlug === slug) : null) || pool[0];
    if (!preferred) return;
    trackRef.current = preferred;
    setTrack(preferred);
    setExpanded(false);
    setPlaying(true);
  }, [slug]);

  // Create / swap the YouTube engine whenever the track changes.
  useEffect(() => {
    if (!track) {
      destroyPlayer();
      return;
    }

    const videoId = youtubeVideoId(track.href);
    const title = track.title;
    const artist = trackArtistName(track.memberSlug);

    if (!videoId) {
      destroyPlayer();
      setPlaying(false);
      return;
    }

    if (playingRef.current) {
      void syncNativeMusic(true, title, artist);
    }

    let cancelled = false;
    void (async () => {
      await loadYouTubeApi();
      if (cancelled || !hostRef.current || !window.YT?.Player) return;
      destroyPlayer();
      const mount = document.createElement("div");
      hostRef.current.appendChild(mount);
      playerRef.current = new window.YT.Player(mount, {
        videoId,
        width: 160,
        height: 90,
        playerVars: {
          autoplay: playingRef.current ? 1 : 0,
          controls: 0,
          rel: 0,
          playsinline: 1,
          modestbranding: 1,
          fs: 0,
          disablekb: 1,
          iv_load_policy: 3,
        },
        events: {
          onReady: (event) => {
            if (cancelled) return;
            if (playingRef.current) {
              event.target.playVideo();
              setPlaying(true);
              void syncNativeMusic(true, title, artist);
            }
          },
          onStateChange: (event) => {
            if (cancelled) return;
            // 0 ended, 1 playing, 2 paused
            if (event.data === 0) {
              skipAutoRef.current(1);
            } else if (event.data === 1) {
              setPlaying(true);
              void syncNativeMusic(true, title, artist);
            } else if (event.data === 2) {
              setPlaying(false);
              void syncNativeMusic(false, title, artist);
            }
          },
        },
      });
    })();

    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title,
          artist,
          artwork: track.thumb ? [{ src: track.thumb, sizes: "512x512", type: "image/jpeg" }] : [],
        });
        navigator.mediaSession.setActionHandler("play", () => {
          playerRef.current?.playVideo();
          setPlaying(true);
          void syncNativeMusic(true, title, artist);
        });
        navigator.mediaSession.setActionHandler("pause", () => {
          playerRef.current?.pauseVideo();
          setPlaying(false);
          void syncNativeMusic(false, title, artist);
        });
        navigator.mediaSession.setActionHandler("stop", () => stop());
        navigator.mediaSession.setActionHandler("nexttrack", () => skipAutoRef.current(1));
        navigator.mediaSession.setActionHandler("previoustrack", () => skipAutoRef.current(-1));
      } catch {
        // Media Session is best-effort.
      }
    }

    return () => {
      cancelled = true;
    };
  }, [track, destroyPlayer, stop]);

  // Pause / resume without remounting when only `playing` flips before engine exists.
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !track) return;
    try {
      if (playing) player.playVideo();
      else player.pauseVideo();
    } catch {
      // Player may be mid-load.
    }
  }, [playing, track]);

  useEffect(() => {
    return () => {
      // Keep native service in sync only when the whole app unloads; don't stop on remount.
    };
  }, []);

  const value = useMemo(
    () => ({
      track,
      expanded,
      playing,
      play,
      stop,
      toggleExpanded,
      togglePlay,
      playQuick,
      playNext,
      playPrev,
    }),
    [track, expanded, playing, play, stop, toggleExpanded, togglePlay, playQuick, playNext, playPrev],
  );

  return (
    <MusicPlayerContext.Provider value={value}>
      {children}
      {/* Keep a tiny in-viewport engine so WebView/YouTube don't treat it as hidden. */}
      <div
        ref={hostRef}
        aria-hidden
        className="pointer-events-none fixed bottom-0 left-0 z-0 h-[90px] w-[160px] overflow-hidden opacity-[0.02]"
      />
      <CustomPlayerShell />
      <MusicLauncher />
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer() {
  const value = useContext(MusicPlayerContext);
  if (!value) throw new Error("MusicPlayerProvider missing");
  return value;
}

function CustomPlayerShell() {
  const { track, expanded, playing, stop, toggleExpanded, togglePlay, playNext, playPrev } =
    useMusicPlayer();
  if (!track) return null;

  const artist = trackArtistName(track.memberSlug);

  if (!expanded) {
    return (
      <div
        className="fixed z-[55] size-14 overflow-hidden rounded-2xl border border-line bg-nav shadow-lg"
        style={{
          right: 16,
          bottom: "calc(5.25rem + env(safe-area-inset-bottom))",
        }}
      >
        {track.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.thumb} alt="" className="absolute inset-0 size-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="absolute inset-0 bg-violet" />
        )}
        <span className="absolute inset-0 bg-black/35" />
        <button
          type="button"
          onClick={toggleExpanded}
          aria-label="플레이어 열기"
          className="absolute inset-0"
        />
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "일시정지" : "재생"}
          className="absolute inset-0 m-auto grid size-8 place-items-center rounded-full bg-white/95 text-violet"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-x-0 z-50 border-t border-line bg-nav px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
      style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-md items-center gap-3 md:max-w-5xl">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-2xl bg-soft">
          {track.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={track.thumb} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <span className="grid size-full place-items-center text-violet">
              <MusicNoteIcon />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{track.title}</p>
          <p className="mt-0.5 truncate text-sm text-muted">{artist}</p>
          {!youtubeVideoId(track.href) && spotifyEmbedUrl(track.href) ? (
            <a href={track.href} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-medium text-violet">
              스포티파이에서 이어듣기
            </a>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={playPrev}
            aria-label="이전 곡"
            className="grid size-10 place-items-center rounded-full text-ink"
          >
            <PrevIcon />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "일시정지" : "재생"}
            className="grid size-11 place-items-center rounded-full bg-violet text-white"
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            type="button"
            onClick={playNext}
            aria-label="다음 곡"
            className="grid size-10 place-items-center rounded-full text-ink"
          >
            <NextIcon />
          </button>
        </div>
        <button type="button" onClick={toggleExpanded} className="shrink-0 text-sm text-muted">
          접기
        </button>
        <button type="button" onClick={stop} className="shrink-0 text-sm text-muted">
          중지
        </button>
      </div>
    </div>
  );
}

function MusicLauncher() {
  const pathname = usePathname();
  const { track, playQuick } = useMusicPlayer();
  if (track) return null;

  // Available on every main tab, not only home.
  const allowed =
    pathname === "/" ||
    pathname.startsWith("/members") ||
    pathname.startsWith("/posts") ||
    pathname.startsWith("/calendar") ||
    pathname.startsWith("/music") ||
    pathname.startsWith("/settings");
  if (!allowed) return null;

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
        <PlayIcon />
      </span>
    </button>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
      <path d="M8 6.5v11l9-5.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
      <path d="M7 6h3.5v12H7zm6.5 0H17v12h-3.5z" />
    </svg>
  );
}

function PrevIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
      <path d="M6 6h2v12H6zm3.5 6 8.5 5.5V6.5z" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
      <path d="M16 6h2v12h-2zM6 6.5v11L14.5 12z" />
    </svg>
  );
}

function MusicNoteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden>
      <path d="M9 18V6l10-2v12" />
      <circle cx="7" cy="18" r="2.5" />
      <circle cx="17" cy="16" r="2.5" />
    </svg>
  );
}
