type StellaMusicNative = {
  playMusic?: (videoId: string, title: string, artist: string) => void;
  pauseMusic?: () => void;
  resumeMusic?: () => void;
  stopMusic?: () => void;
  setMusicPlaying?: (on: boolean, title: string, artist: string) => void;
};

async function nativeApi(): Promise<StellaMusicNative | null> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return null;
    return (window as Window & { StellaNative?: StellaMusicNative }).StellaNative ?? null;
  } catch {
    return null;
  }
}

export async function isNativeMusicEngine() {
  const api = await nativeApi();
  return Boolean(api?.playMusic);
}

export async function nativePlayMusic(videoId: string, title: string, artist: string) {
  const api = await nativeApi();
  api?.playMusic?.(videoId, title, artist);
}

export async function nativePauseMusic() {
  const api = await nativeApi();
  api?.pauseMusic?.();
}

export async function nativeResumeMusic() {
  const api = await nativeApi();
  api?.resumeMusic?.();
}

export async function nativeStopMusic() {
  const api = await nativeApi();
  if (api?.stopMusic) api.stopMusic();
  else api?.setMusicPlaying?.(false, "", "");
}
