/** Keep YouTube audio alive when the WebView is backgrounded. */

type ResumeFn = () => void;

let resumeFn: ResumeFn | null = null;
let shieldInstalled = false;
let watchdog: ReturnType<typeof setInterval> | null = null;

declare global {
  interface Window {
    __stellaResumeMusic?: () => void;
  }
}

export function setMusicResumeHandler(fn: ResumeFn | null) {
  resumeFn = fn;
  if (typeof window !== "undefined") {
    window.__stellaResumeMusic = () => {
      fn?.();
    };
  }
}

export function requestMusicResume() {
  resumeFn?.();
}

export function installMusicBackgroundShield() {
  if (typeof document === "undefined" || shieldInstalled) return;
  shieldInstalled = true;

  try {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  } catch {
    // Some WebViews lock these; watchdog still helps.
  }

  const nudge = () => requestMusicResume();
  document.addEventListener("visibilitychange", nudge, true);
  document.addEventListener("pause", nudge, false);
  document.addEventListener("resume", nudge, false);
  window.addEventListener("pagehide", nudge, true);
  window.addEventListener("blur", nudge, true);
}

export function startMusicWatchdog() {
  if (watchdog) return;
  watchdog = setInterval(() => requestMusicResume(), 2500);
}

export function stopMusicWatchdog() {
  if (!watchdog) return;
  clearInterval(watchdog);
  watchdog = null;
}
