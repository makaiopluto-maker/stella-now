"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { occursOn, schedule, seoulToday } from "@/content/schedule";
import { withBasePath } from "@/lib/base-path";
import { readFlag, readJson, subscribePref, writeJson } from "@/lib/prefs";

const alertKey = "stella-now-schedule-alert";
const seenKey = "stella-now-schedule-seen";

type Seen = { day: string; ids: string[] };

export function ScheduleAlert() {
  const [banner, setBanner] = useState<{ title: string; href: string } | null>(null);

  useEffect(() => {
    let stop = false;

    function check() {
      if (!readFlag(alertKey) || stop) return;
      const today = seoulToday();
      const day = `${today.year}-${today.month}-${today.day}`;
      const due = schedule.filter((item) => occursOn(item, today));
      if (due.length === 0) return;
      const seen = readJson<Seen>(seenKey, { day: "", ids: [] });
      const ids = seen.day === day ? seen.ids : [];
      const next = due.find((item) => !ids.includes(item.id ?? item.title));
      if (!next) return;
      const token = next.id ?? next.title;
      writeJson(seenKey, { day, ids: [...ids, token] });
      setBanner({ title: next.title, href: next.href });
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        const note = new Notification(`오늘 일정 · ${next.title}`, { body: "일정 탭에서 확인할 수 있어요" });
        note.onclick = () => {
          const href = next.href.startsWith("/") ? next.href : "/calendar/";
          window.location.assign(withBasePath(href));
        };
      }
    }

    check();
    const timer = window.setInterval(check, 60_000);
    const stopPref = subscribePref(alertKey, () => check());
    return () => {
      stop = true;
      window.clearInterval(timer);
      stopPref();
    };
  }, []);

  if (!banner) return null;

  const internal = banner.href.startsWith("/");
  const body = (
    <>
      <span className="block text-sm font-medium">오늘 일정 · {banner.title}</span>
      <span className="mt-0.5 block text-xs text-white/70">눌러서 자세히 보기</span>
    </>
  );

  return (
    <div className="fixed inset-x-4 top-4 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-lg">
      {internal ? (
        <Link href={banner.href} className="min-w-0 flex-1">
          {body}
        </Link>
      ) : (
        <a href={banner.href} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
          {body}
        </a>
      )}
      <button type="button" onClick={() => setBanner(null)} className="text-sm text-white/80">
        닫기
      </button>
    </div>
  );
}

export { alertKey as scheduleAlertKey };
