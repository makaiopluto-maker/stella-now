"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ApkDownload } from "@/components/apk-download";
import { ExternalLink } from "@/components/external-link";
import { PrefSwitch } from "@/components/pref-switch";
import { useOshi } from "@/components/oshi";
import { ProfileAvatar } from "@/components/profile-avatar";
import { scheduleAlertKey } from "@/components/schedule-alert";
import { members, shortName } from "@/content/members";
import {
  clearDismissedVersion,
  fetchLatestAppVersion,
  installedAppVersion,
  isNewerVersion,
} from "@/lib/app-update";
import { appDownload } from "@/content/app-download";
import { readTheme, subscribeTheme, writeTheme, type ThemeMode } from "@/lib/theme";

const shortcuts = [
  { href: "/calendar", label: "일정", detail: "방송과 생일" },
  { href: "/goods", label: "굿즈", detail: "팬딩 상품" },
  { href: "/bookmarks", label: "저장한 글", detail: "북마크" },
  { href: "/music", label: "음원", detail: "앱에서 재생" },
];

const hideRepliesKey = "stella-now-hide-replies";
const themes: Array<{ id: ThemeMode; label: string }> = [
  { id: "system", label: "시스템" },
  { id: "light", label: "라이트" },
  { id: "dark", label: "다크" },
];

export default function SettingsPage() {
  const { slug, alert, choose, clear, setAlerts } = useOshi();
  const oshi = members.find((member) => member.slug === slug);
  const [deviceAlert, setDeviceAlert] = useState<NotificationPermission | "unknown">("unknown");
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "system" as ThemeMode);
  const [currentVersion, setCurrentVersion] = useState(appDownload.version);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [updateHref, setUpdateHref] = useState(appDownload.href);
  const [updateStatus, setUpdateStatus] = useState("확인 중");

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

  useEffect(() => {
    let cancel = false;
    async function load() {
      const current = await installedAppVersion();
      if (cancel) return;
      setCurrentVersion(current);
      const latest = await fetchLatestAppVersion();
      if (cancel) return;
      if (!latest?.version) {
        setUpdateStatus("최신 버전을 불러오지 못했어요");
        return;
      }
      setLatestVersion(latest.version);
      setUpdateHref(latest.apk || appDownload.href);
      setUpdateStatus(
        isNewerVersion(latest.version, current)
          ? `새 버전 ${latest.version} 있음`
          : "최신 버전입니다",
      );
    }
    void load();
    return () => {
      cancel = true;
    };
  }, []);

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
          멤버를 고르고 알림을 켜면, 앱을 닫아 둬도 백그라운드에서 방송 시작을 알려줍니다.
        </p>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3.5">
          <span>
            <span className="block font-medium">방송 알림</span>
            <span className="mt-0.5 block text-sm text-muted">
              {!oshi
                ? "먼저 멤버를 고르세요."
                : alert && deviceAlert === "denied"
                  ? "기기 알림 권한을 허용해 주세요."
                  : alert
                    ? "백그라운드에서도 켜짐"
                    : "꺼짐"}
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={alert}
            aria-label="방송 알림"
            disabled={!oshi}
            onClick={() => void setAlerts(!alert)}
            className={`relative h-7 w-12 shrink-0 rounded-full ${alert ? "bg-violet" : "bg-soft"} disabled:opacity-40`}
          >
            <span className={`absolute top-0.5 size-6 rounded-full bg-paper ${alert ? "left-5" : "left-0.5"}`} />
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
                    active ? "border-violet bg-soft-strong text-violet" : "border-line"
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
        <h2 className="text-lg font-bold">화면</h2>
        <p className="mt-1 text-sm leading-6 text-muted">라이트 / 다크 테마를 고르세요.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {themes.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={theme === item.id}
              onClick={() => writeTheme(item.id)}
              className={`h-9 rounded-full px-4 text-sm font-medium ${
                theme === item.id ? "bg-violet text-white" : "bg-soft text-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
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

      <section className="mt-8">
        <h2 className="text-lg font-bold">앱 버전</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          현재 {currentVersion}
          {latestVersion ? ` · 최신 ${latestVersion}` : ""}
        </p>
        <div className="mt-3 rounded-xl border border-line px-4 py-3.5">
          <p className="text-sm font-medium">{updateStatus}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="h-9 rounded-full bg-soft px-4 text-sm font-medium"
              onClick={() => {
                clearDismissedVersion();
                void (async () => {
                  setUpdateStatus("확인 중");
                  const current = await installedAppVersion();
                  setCurrentVersion(current);
                  const latest = await fetchLatestAppVersion();
                  if (!latest?.version) {
                    setUpdateStatus("최신 버전을 불러오지 못했어요");
                    return;
                  }
                  setLatestVersion(latest.version);
                  setUpdateHref(latest.apk || appDownload.href);
                  setUpdateStatus(
                    isNewerVersion(latest.version, current)
                      ? `새 버전 ${latest.version} 있음`
                      : "최신 버전입니다",
                  );
                })();
              }}
            >
              다시 확인
            </button>
            {latestVersion && isNewerVersion(latestVersion, currentVersion) ? (
              <ExternalLink
                href={updateHref}
                className="inline-flex h-9 items-center rounded-full bg-violet px-4 text-sm font-medium text-white"
              >
                업데이트 받기
              </ExternalLink>
            ) : null}
          </div>
        </div>
      </section>

      <p className="mt-8 text-sm leading-6 text-muted">
        팬이 만든 안내 페이지입니다. 방송은 치지직, 음원은 유튜브, 굿즈 결제와 재고는 팬딩에서
        이어집니다.
      </p>
    </div>
  );
}
