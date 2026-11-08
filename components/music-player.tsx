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
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const { slug } = useOshi();
  const playerRef = useRef<YtPlayer | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<Track | null>(null);

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
    void syncNativeMusic(false, "", "");
  }, [destroyPlayer]);

  const play = useCallback((next: Track) => {
    trackRef.current = next;
    setTrack(next);
    setExpanded(true);
    setPlaying(true);
  }, []);

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
      } else {
        player.playVideo();
        setPlaying(true);
      }
    } catch {
      setPlaying((value) => !value);
    }
  }, []);

  const playQuick = useCallback(() => {
    const pool = tracks.filter(canEmbed);
    const preferred =
      (slug ? pool.find((item) => item.memberSlug === slug && youtubeVideoId(item.href)) : null) ||
      pool.find((item) => youtubeVideoId(item.href)) ||
      pool[0];
    if (!preferred) return;
    trackRef.current = preferred;
    setTrack(preferred);
    setExpanded(false);
    setPlaying(true);
  }, [slug]);

  // Create / swap the hidden YouTube engine whenever the track changes.
  useEffect(() => {
    if (!track) {
      destroyPlayer();
      return;
    }

    const videoId = youtubeVideoId(track.href);
    const title = track.title;
    const artist = trackArtistName(track.memberSlug);
    void syncNativeMusic(true, title, artist);

    if (!videoId) {
      // Spotify (and other) tracks use the visible custom shell + optional embed fallback.
      destroyPlayer();
      setPlaying(true);
      return;
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
        width: 320,
        height: 180,
        playerVars: {
          autoplay: 1,
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
            event.target.playVideo();
            setPlaying(true);
          },
          onStateChange: (event) => {
            if (cancelled) return;
            // 0 ended, 1 playing, 2 paused
            if (event.data === 0) {
              setPlaying(false);
              void syncNativeMusic(false, "", "");
            } else if (event.data === 1) {
              setPlaying(true);
              void syncNativeMusic(true, title, artist);
            } else if (event.data === 2) {
              setPlaying(false);
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
        });
        navigator.mediaSession.setActionHandler("pause", () => {
          playerRef.current?.pauseVideo();
          setPlaying(false);
        });
        navigator.mediaSession.setActionHandler("stop", () => stop());
      } catch {
        // Media Session is best-effort.
      }
    }

    return () => {
      cancelled = true;
    };
  }, [track, destroyPlayer, stop]);

  useEffect(() => {
    return () => {
      destroyPlayer();
      void syncNativeMusic(false, "", "");
    };
  }, [destroyPlayer]);

  const value = useMemo(
    () => ({ track, expanded, playing, play, stop, toggleExpanded, togglePlay, playQuick }),
    [track, expanded, playing, play, stop, toggleExpanded, togglePlay, playQuick],
  );

  return (
    <MusicPlayerContext.Provider value={value}>
      {children}
      {/* Hidden YouTube engine — audio only, custom UI on top. */}
      <div
        ref={hostRef}
        aria-hidden
        className="pointer-events-none fixed -left-[9999px] top-0 h-[180px] w-[320px] overflow-hidden opacity-0"
      />
      <CustomPlayerShell />
      <HomeMusicLauncher />
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer() {
  const value = useContext(MusicPlayerContext);
  if (!value) throw new Error("MusicPlayerProvider missing");
  return value;
}

function CustomPlayerShell() {
  const { track, expanded, playing, stop, toggleExpanded, togglePlay } = useMusicPlayer();
  if (!track) return null;

  const artist = trackArtistName(track.memberSlug);
  const spotify = !youtubeVideoId(track.href) ? spotifyEmbedUrl(track.href) : null;

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
      className="fixed inset-x-0 z-50 border-t border-line bg-nav px-4 py-4 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
      style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-md items-center gap-3 md:max-w-5xl">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-soft">
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
          {spotify ? (
            <a href={track.href} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-medium text-violet">
              스포티파이에서 이어듣기
            </a>
          ) : null}
        </div>
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "일시정지" : "재생"}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-violet text-white"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
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

function MusicNoteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden>
      <path d="M9 18V6l10-2v12" />
      <circle cx="7" cy="18" r="2.5" />
      <circle cx="17" cy="16" r="2.5" />
    </svg>
  );
}
