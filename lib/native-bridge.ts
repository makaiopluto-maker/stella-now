import { getMember } from "@/content/members";

type StellaNative = {
  setOshiAlert?: (slug: string, channelId: string, name: string, enabled: boolean) => void;
  requestNotifyPermission?: () => void;
};

function native(): StellaNative | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { StellaNative?: StellaNative }).StellaNative;
}

export async function syncNativeOshi(slug: string | null, alert: boolean) {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
  } catch {
    return;
  }

  const api = native();
  if (!api?.setOshiAlert) return;
  const member = slug ? getMember(slug) : null;
  const channelId = member?.chzzk.split("/").filter(Boolean).pop() ?? "";
  const name = member ? member.name.split(" ").pop() || member.name : "";
  api.setOshiAlert(slug ?? "", channelId, name, Boolean(alert && member));
  if (alert && member) api.requestNotifyPermission?.();
}
