"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "@/components/external-link";
import { appDownload } from "@/content/app-download";

export function ApkDownload() {
  const [native, setNative] = useState(false);

  useEffect(() => {
    void import("@capacitor/core").then(({ Capacitor }) => {
      setNative(Capacitor.isNativePlatform());
    });
  }, []);

  if (native) return null;

  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">앱 설치</h2>
      <p className="mt-1 text-sm leading-6 text-muted">
        Android용 Stella Now APK입니다. 브라우저에서 받아 설치하세요.
      </p>
      <div className="mt-3 rounded-xl border border-line px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-medium">{appDownload.label}</span>
            <span className="mt-0.5 block text-sm text-muted">버전 {appDownload.version}</span>
          </span>
          <ExternalLink
            href={appDownload.href}
            className="inline-flex h-10 shrink-0 items-center rounded-full bg-violet px-4 text-sm font-medium text-white"
          >
            다운로드
          </ExternalLink>
        </div>
      </div>
    </section>
  );
}
