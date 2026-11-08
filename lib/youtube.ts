export function youtubeVideoId(href: string) {
  try {
    const url = new URL(href);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.split("/").filter(Boolean)[0] || null;
    }
    if (url.searchParams.get("v")) return url.searchParams.get("v");
    const parts = url.pathname.split("/").filter(Boolean);
    const marker = parts.findIndex((part) => part === "shorts" || part === "embed" || part === "live");
    if (marker >= 0 && parts[marker + 1]) return parts[marker + 1];
  } catch {
    // Fall through.
  }
  const match = href.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{6,})/);
  return match?.[1] ?? null;
}

export function spotifyEmbedUrl(href: string) {
  try {
    const url = new URL(href);
    if (!url.hostname.includes("spotify.com")) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    const kind = parts[0];
    const id = parts[1]?.split("?")[0];
    if (!kind || !id) return null;
    if (!["track", "album", "playlist", "episode"].includes(kind)) return null;
    return `https://open.spotify.com/embed/${kind}/${id}`;
  } catch {
    return null;
  }
}
