/** Legacy helpers — native builds now play inside MusicKeepAliveService. */

export function setMusicResumeHandler(_fn: (() => void) | null) {}

export function requestMusicResume(_force = false) {}

export function installMusicBackgroundShield() {}

export function startMusicWatchdog() {}

export function stopMusicWatchdog() {}
