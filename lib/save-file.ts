function triggerDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function openRemote(url: string) {
  window.open(url, "_blank", "noopener");
}

function blobFromHttpData(data: unknown, contentType?: string): Blob {
  if (data instanceof Blob) return data;
  if (data instanceof ArrayBuffer) return new Blob([data], { type: contentType || "application/octet-stream" });
  if (typeof data === "string") {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: contentType || "application/octet-stream" });
  }
  throw new Error("bad download payload");
}

export type SaveRemoteResult = "downloaded" | "opened";

export async function saveRemoteFile(url: string, filename: string): Promise<SaveRemoteResult> {
  const { Capacitor, CapacitorHttp } = await import("@capacitor/core");
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({
      url,
      responseType: "blob",
      headers: url.includes("pstatic.net")
        ? { Accept: "*/*", "User-Agent": "StellaNow/1.0", Referer: "" }
        : { Accept: "*/*", "User-Agent": "StellaNow/1.0" },
    });
    if (response.status < 200 || response.status >= 300) throw new Error(String(response.status));
    const type = response.headers?.["Content-Type"] || response.headers?.["content-type"];
    triggerDownload(blobFromHttpData(response.data, type), filename);
    return "downloaded";
  }

  // Browser CDNs (X media, Naver pstatic, etc.) often omit CORS headers.
  // Prefer a real blob download when allowed; otherwise open the file without throwing.
  try {
    const response = await fetch(url, {
      mode: "cors",
      ...(url.includes("pstatic.net") ? { referrerPolicy: "no-referrer" as const } : {}),
    });
    if (!response.ok) throw new Error(String(response.status));
    triggerDownload(await response.blob(), filename);
    return "downloaded";
  } catch {
    openRemote(url);
    return "opened";
  }
}
