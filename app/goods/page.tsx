import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SettingsButton } from "@/components/settings-button";
import { fandingShop } from "@/content/goods";
import { goodsSales, type GoodsSale } from "@/content/goods-sales";
import { seoulToday } from "@/content/schedule";

export const metadata: Metadata = { title: "굿즈 · Stella Now" };

export default function GoodsPage() {
  const today = seoulToday();
  const todayValue = today.year * 10000 + today.month * 100 + today.day;
  const selling = group(goodsSales.filter((item) => isSelling(item, todayValue)));
  const upcoming = group(goodsSales.filter((item) => isUpcoming(item, todayValue)));
  const ended = group(goodsSales.filter((item) => isEnded(item, todayValue))).slice(0, 8);

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight">굿즈</h1>
          <p className="mt-1 text-[15px] text-muted">팬딩에 올라온 판매 일정</p>
        </div>
        <SettingsButton />
      </div>

      <a
        href={fandingShop}
        target="_blank"
        rel="noreferrer"
        className="mt-5 flex h-12 items-center justify-center rounded-xl bg-violet text-[15px] font-medium text-white"
      >
        팬딩 스토어 열기
      </a>

      <Section title="판매 중" empty="지금 판매 중인 묶음이 없습니다">
        {selling.map((item) => (
          <GoodsGroup key={item.label} item={item} tone="live" />
        ))}
      </Section>

      <Section title="예정" empty="예정된 판매가 없습니다">
        {upcoming.map((item) => (
          <GoodsGroup key={item.label} item={item} tone="soon" />
        ))}
      </Section>

      <Section title="최근 종료" empty="종료된 판매가 없습니다">
        {ended.map((item) => (
          <GoodsGroup key={item.label} item={item} tone="done" />
        ))}
      </Section>

      <p className="mt-8 text-sm leading-6 text-muted">
        결제와 재고는 팬딩에서 이어집니다.{" "}
        <Link href="/calendar" className="font-medium text-violet">
          일정
        </Link>
        에서도 판매 시작·종료일을 볼 수 있어요.
      </p>
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const filled = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">{title}</h2>
      {filled.length === 0 ? <p className="mt-4 text-sm text-[#b0b4be]">{empty}</p> : <ul className="mt-4 space-y-3">{children}</ul>}
    </section>
  );
}

function GoodsGroup({
  item,
  tone,
}: {
  item: { label: string; href: string; count: number; start: string | null; end: string | null };
  tone: "live" | "soon" | "done";
}) {
  const badge = tone === "live" ? "판매 중" : tone === "soon" ? "예정" : "종료";
  const badgeClass = tone === "live" ? "text-[#ef3b3b]" : tone === "soon" ? "text-violet" : "text-muted";
  return (
    <li>
      <a href={item.href} target="_blank" rel="noreferrer" className="block rounded-2xl bg-[#f2f3f7] px-4 py-3.5">
        <span className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className={`text-xs font-semibold ${badgeClass}`}>{badge}</span>
            <span className="mt-1 block text-[15px] font-bold leading-tight">{item.label}</span>
            <span className="mt-1 block text-sm text-muted">
              {item.count}개 · {rangeLabel(item.start, item.end)}
            </span>
          </span>
          <span className="shrink-0 text-sm font-medium text-violet">보기</span>
        </span>
      </a>
    </li>
  );
}

function group(rows: GoodsSale[]) {
  const map = new Map<string, { label: string; hrefs: string[]; start: string | null; end: string | null }>();
  for (const item of rows) {
    const label = item.tag || item.name;
    const current = map.get(label);
    if (current) {
      current.hrefs.push(item.href);
      if (item.start && (!current.start || item.start < current.start)) current.start = item.start;
      if (item.end && (!current.end || item.end > current.end)) current.end = item.end;
    } else {
      map.set(label, { label, hrefs: [item.href], start: item.start, end: item.end });
    }
  }
  return [...map.values()]
    .map((item) => ({
      label: item.label,
      href: item.hrefs.length === 1 ? item.hrefs[0] : fandingShop,
      count: item.hrefs.length,
      start: item.start,
      end: item.end,
    }))
    .sort((a, b) => (a.end ?? a.start ?? "").localeCompare(b.end ?? b.start ?? ""));
}

function isSelling(item: GoodsSale, today: number) {
  if (!item.start && !item.end) return false;
  const start = dateNumber(item.start);
  const end = dateNumber(item.end);
  if (start && start > today) return false;
  if (end && end < today) return false;
  return Boolean(item.end) || Boolean(item.start);
}

function isUpcoming(item: GoodsSale, today: number) {
  const start = dateNumber(item.start);
  return Boolean(start && start > today);
}

function isEnded(item: GoodsSale, today: number) {
  const end = dateNumber(item.end);
  return Boolean(end && end < today);
}

function dateNumber(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return year * 10000 + month * 100 + day;
}

function rangeLabel(start: string | null, end: string | null) {
  if (start && end) return `${shortDate(start)} ~ ${shortDate(end)}`;
  if (end) return `${shortDate(end)}까지`;
  if (start) return `${shortDate(start)}부터`;
  return "상시";
}

function shortDate(value: string) {
  const [, month, day] = value.split("-").map(Number);
  return `${month}월 ${day}일`;
}
