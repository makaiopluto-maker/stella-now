/** Gentle helpers so backgrounding the app does not kill YouTube audio. */

type ResumeFn = () => void;

let resumeFn: ResumeFn | null = null;
let shieldInstalled = false;
let lastResumeAt = 0;

declare global {
  interface Window {
    __stellaResumeMusic?: () => void;
  }
}

export function setMusicResumeHandler(fn: ResumeFn | null) {
  resumeFn = fn;
  if (typeof window !== "undefined") {
    window.__stellaResumeMusic = () => {
      // Native may call this a few times around onPause — coalesce hard.
      const now = Date.now();
      if (now - lastResumeAt < 4000) return;
      lastResumeAt = now;
      fn?.();
    };
  }
}

export function requestMusicResume(force = false) {
  const now = Date.now();
  if (!force && now - lastResumeAt < 4000) return;
  lastResumeAt = now;
  resumeFn?.();
}

/** Spoof page visibility so YouTube is less eager to auto-pause. No play/pause spam. */
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
    // Some WebViews lock these.
  }

  // Only react to Capacitor's pause event (app backgrounded), not blur/pagehide spam.
  document.addEventListener(
    "pause",
    () => {
      window.setTimeout(() => requestMusicResume(true), 600);
    },
    false,
  );
}

export function startMusicWatchdog() {
  // Intentionally empty — periodic playVideo() caused audible stuttering.
}

export function stopMusicWatchdog() {
  // No-op; kept for call-site compatibility.
}
