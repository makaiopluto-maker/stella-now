"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApkDownload } from "@/components/apk-download";
import { PrefSwitch } from "@/components/pref-switch";
import { useOshi } from "@/components/oshi";
import { ProfileAvatar } from "@/components/profile-avatar";
import { scheduleAlertKey } from "@/components/schedule-alert";
import { members, shortName } from "@/content/members";

const shortcuts = [
  { href: "/calendar", label: "일정", detail: "방송과 생일" },
  { href: "/goods", label: "굿즈", detail: "팬딩 상품" },
  { href: "/bookmarks", label: "저장한 글", detail: "북마크" },
  { href: "/music", label: "음원", detail: "유튜브 · 스포티파이" },
];

const hideRepliesKey = "stella-now-hide-replies";

export default function SettingsPage() {
  const { slug, alert, choose, clear, setAlerts } = useOshi();
  const oshi = members.find((member) => member.slug === slug);
  const [deviceAlert, setDeviceAlert] = useState<NotificationPermission | "unknown">("unknown");

  useEffect(() => {
    let cancel = false;
    // Defer past the effect body so permission is read after paint / alert toggles.
    queueMicrotask(() => {
      if (cancel) return;
      setDeviceAlert(typeof Notification === "undefined" ? "denied" : Notification.permission);
    });
    return () => {
      cancel = true;
    };
  }, [alert]);

  return (
    <div>
      <h1 className="text-[32px] font-bold tracking-tight">설정</h1>

      <section className="mt-6">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg font-bold">오시</h2>
          {oshi ? (
            <button type="button" onClick={clear} className="text-sm font-medium text-violet">
              해제
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-sm leading-6 text-muted">
          멤버를 고르고 알림을 켜면, 이 화면이 켜져 있는 동안 그 멤버의 방송이 시작될 때 알려줍니다.
        </p>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3.5">
          <span>
            <span className="block font-medium">방송 알림</span>
            <span className="mt-0.5 block text-sm text-muted">
              {!oshi ? "먼저 멤버를 고르세요." : alert && deviceAlert === "denied" ? "기기 알림이 꺼져 있어 앱 안에서만 알려줍니다." : alert ? "켜짐" : "꺼짐"}
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={alert}
            aria-label="방송 알림"
            disabled={!oshi}
            onClick={() => void setAlerts(!alert)}
            className={`relative h-7 w-12 shrink-0 rounded-full ${alert ? "bg-violet" : "bg-[#e6e8ee]"} disabled:opacity-40`}
          >
            <span className={`absolute top-0.5 size-6 rounded-full bg-white ${alert ? "left-5" : "left-0.5"}`} />
          </button>
        </div>
        <PrefSwitch
          storageKey={scheduleAlertKey}
          label="일정 알림"
          detail="생일·판매 종료 같은 오늘 일정을 앱이 켜져 있을 때 알려줍니다."
          ariaLabel="일정 알림"
          onEnable={async () => {
            if (typeof Notification !== "undefined" && Notification.permission === "default") {
              try {
                await Notification.requestPermission();
              } catch {
                // In-app banner still works without device notifications.
              }
            }
          }}
        />
        <PrefSwitch
          storageKey={hideRepliesKey}
          label="답글 숨기기"
          detail="게시물 탭에서 X 답글을 가립니다."
          ariaLabel="답글 숨기기"
        />
        <ul className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
          {members.map((member) => {
            const active = member.slug === slug;
            return (
              <li key={member.slug}>
                <button
                  type="button"
                  onClick={() => (active ? clear() : choose(member.slug))}
                  aria-pressed={active}
                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm ${
                    active ? "border-violet bg-[#f3f0ff] text-violet" : "border-line"
                  }`}
                >
                  <ProfileAvatar slug={member.slug} className="size-8" />
                  <span className="font-medium">{shortName(member.name)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold">바로가기</h2>
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line">
          {shortcuts.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="flex items-center justify-between px-4 py-3.5">
                <span className="font-medium">{item.label}</span>
                <span className="text-sm text-muted">{item.detail}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <ApkDownload />

      <p className="mt-8 text-sm leading-6 text-muted">
        팬이 만든 안내 페이지입니다. 방송은 치지직, 음원은 유튜브, 굿즈 결제와 재고는 팬딩에서
        이어집니다.
      </p>
    </div>
  );
}
