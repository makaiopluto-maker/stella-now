"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { LiveMark } from "@/components/live-mark";
import { type LiveInfo, liveInfo } from "@/content/live";
import { members } from "@/content/members";
import { refreshMemberLives } from "@/lib/refresh-live";

type LiveStore = {
  statuses: Record<string, LiveInfo>;
  checked: Record<string, boolean>;
  refreshing: boolean;
  failed: boolean;
};

const initialStatuses = Object.fromEntries(members.map((member) => [member.slug, liveInfo(member.slug)]));
// Snapshot from the last build/export is already trusted — show LIVE badges immediately.
const initialChecked = Object.fromEntries(members.map((member) => [member.slug, true]));
let store: LiveStore = { statuses: initialStatuses, checked: initialChecked, refreshing: false, failed: false };
const listeners = new Set<() => void>();
let users = 0;
let poll = 0;
let refreshing = false;

function emit(next: LiveStore) {
  store = next;
  listeners.forEach((listener) => listener());
}

async function refresh() {
  if (refreshing) return;
  refreshing = true;
  emit({ ...store, refreshing: true, failed: false });
  try {
    const fresh = await refreshMemberLives(members, (slug, info) => {
      emit({
        statuses: { ...store.statuses, [slug]: info },
        checked: { ...store.checked, [slug]: true },
        refreshing: true,
        failed: false,
      });
    });
    const checked = { ...store.checked };
    for (const slug of Object.keys(fresh)) checked[slug] = true;
    emit({ statuses: { ...store.statuses, ...fresh }, checked, refreshing: false, failed: false });
  } catch {
    emit({ ...store, refreshing: false, failed: true });
  } finally {
    refreshing = false;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  users += 1;
  if (users === 1) {
    void refresh();
    poll = window.setInterval(() => void refresh(), 60_000);
  }
  return () => {
    listeners.delete(listener);
    users -= 1;
    if (users === 0) window.clearInterval(poll);
  };
}

function getSnapshot() {
  return store;
}

export function useLiveStatuses() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(clock);
  }, []);

  return {
    now,
    statuses: current.statuses,
    checked: current.checked,
    refreshing: current.refreshing,
    failed: current.failed,
    refresh,
  };
}

export function LiveDot({ slug, className }: { slug: string; className: string }) {
  const { statuses, checked } = useLiveStatuses();
  if (!checked[slug] || !statuses[slug]?.live) return null;
  return <span className={className} />;
}

export function LiveBadge({ slug }: { slug: string }) {
  const { statuses, checked } = useLiveStatuses();
  if (!checked[slug] || !statuses[slug]?.live) return null;
  return <LiveMark />;
}

export function LiveWatch({ slug, href }: { slug: string; href: string }) {
  const { statuses, checked } = useLiveStatuses();
  const info = statuses[slug];
  if (!checked[slug] || !info?.live) return null;
  return (
    <a href={href} className="mt-5 flex items-center justify-between rounded-2xl bg-soft px-4 py-3">
      <span className="text-sm font-medium text-[#ef3b3b]">지금 방송 중</span>
      <span className="text-xs text-muted">시청 {info.viewers.toLocaleString("ko-KR")}명</span>
    </a>
  );
}

export function broadcastLine(openDate: string | null, viewers: number, now: number) {
  const time = openDate ? elapsed(openDate, now) : null;
  const watching = `시청 ${viewers.toLocaleString("ko-KR")}명`;
  return time ? `${time} · ${watching}` : watching;
}

function elapsed(openDate: string, now: number) {
  const started = new Date(`${openDate.replace(" ", "T")}+09:00`).getTime();
  const minutes = Math.max(0, Math.floor((now - started) / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}시간 ${rest}분` : `${rest}분`;
}
