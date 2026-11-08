/** GitHub Pages basePath (`/stella-now`) or empty for Capacitor / plain hosting. */
export function siteBasePath() {
  return process.env.NEXT_PUBLIC_BASE_PATH || "";
}

/** Prefix an absolute app path so `window.location` / fetch work under Pages. */
export function withBasePath(path: string) {
  if (!path.startsWith("/")) return path;
  return `${siteBasePath()}${path}`;
}
