"use client";

import Link from "next/link";
import { SettingsButton } from "@/components/settings-button";
import { useEffect, useState, type ReactNode } from "react";
import {
  monthCells,
  occurrence,
  occursOn,
  relativeLabel,
  schedule,
  seoulToday,
  shiftMonth,
  weekdayLabel,
  type CalendarDate,
  type ScheduleItem,
} from "@/content/schedule";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

export function ScheduleBoard() {
  const [today, setToday] = useState<CalendarDate | null>(null);
  const [visible, setVisible] = useState<{ year: number; month: number } | null>(null);
  const [selected, setSelected] = useState<CalendarDate | null>(null);

  useEffect(() => {
    let cancel = false;
    // Client-only Seoul calendar date — defer to avoid sync setState-in-effect lint.
    queueMicrotask(() => {
      if (cancel) return;
      const current = seoulToday();
      setToday(current);
      setVisible({ year: current.year, month: current.month });
    });
    return () => {
      cancel = true;
    };
  }, []);

  if (!today || !visible) {
    return (
      <div>
        <div className="flex items-start justify-between">
          <h1 className="text-[32px] font-bold tracking-tight">일정</h1>
          <SettingsButton />
        </div>
        <p className="mt-1 text-[15px] text-muted">날짜를 누르면 그날 일정이 나와요</p>
        <div className="mt-6 h-[28rem] rounded-2xl bg-[#f7f8fb]" />
      </div>
    );
  }
  const cells = monthCells(visible.year, visible.month);
  const dated = schedule.map((item) => ({ item, date: occurrence(item, today) }));
  const upcoming = dated
    .filter((entry) => dayRank(entry.date) >= dayRank(today))
    .sort((a, b) => dayRank(a.date) - dayRank(b.date));
  const past = dated
    .filter((entry) => dayRank(entry.date) < dayRank(today))
    .sort((a, b) => dayRank(b.date) - dayRank(a.date));
  const selectedEvents = selected ? schedule.filter((item) => occursOn(item, selected)) : [];
  const showingToday = visible.year === today.year && visible.month === today.month;

  function openDate(date: CalendarDate) {
    setVisible({ year: date.year, month: date.month });
    setSelected(date);
  }

  return (
    <div>
      <div className="flex items-start justify-between">
        <h1 className="text-[32px] font-bold tracking-tight">일정</h1>
        <SettingsButton />
      </div>
      <p className="mt-1 text-[15px] text-muted">날짜를 누르면 그날 일정이 나와요</p>

      <div className="mt-6 md:grid md:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] md:items-start md:gap-10">
        <section className="rounded-2xl border border-line px-3 py-4 sm:px-4">
          <div className="flex items-center justify-between gap-2 px-1">
            <button
              type="button"
              aria-label="이전 달"
              onClick={() => setVisible(shiftMonth(visible.year, visible.month, -1))}
              className="grid size-10 place-items-center rounded-full text-ink"
            >
              <Chevron direction="left" />
            </button>
            <div className="text-center">
              <p className="text-lg font-bold">
                {visible.year}년 {visible.month}월
              </p>
              {showingToday ? null : (
                <button
                  type="button"
                  onClick={() => setVisible({ year: today.year, month: today.month })}
                  className="mt-0.5 text-xs font-medium text-violet"
                >
                  오늘
                </button>
              )}
            </div>
            <button
              type="button"
              aria-label="다음 달"
              onClick={() => setVisible(shiftMonth(visible.year, visible.month, 1))}
              className="grid size-10 place-items-center rounded-full text-ink"
            >
              <Chevron direction="right" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 text-center text-xs text-muted">
            {weekdays.map((label) => (
              <div key={label} className="py-2">
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell) => {
              const key = `${cell.year}-${cell.month}-${cell.day}`;
              const hasEvent = schedule.some((item) => occursOn(item, cell));
              const isToday = sameDate(cell, today);
              const isSelected = selected ? sameDate(cell, selected) : false;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`${cell.month}월 ${cell.day}일${hasEvent ? ", 일정 있음" : ""}`}
                  onClick={() => openDate(cell)}
                  className="flex h-12 flex-col items-center justify-center"
                >
                  <span
                    className={`grid size-8 place-items-center rounded-full text-sm ${
                      isSelected
                        ? "bg-violet font-medium text-white"
                        : isToday || (hasEvent && cell.inMonth)
                          ? "font-bold text-violet"
                          : cell.inMonth
                            ? "text-ink"
                            : "text-[#c5c8d0]"
                    }`}
                  >
                    {cell.day}
                  </span>
                  <span className={`size-1.5 rounded-full ${hasEvent && !isSelected ? "bg-violet" : "bg-transparent"}`} />
                </button>
              );
            })}
          </div>
        </section>

        <div className="mt-8 md:mt-0">
          {selected ? (
            <section>
              <h2 className="text-sm font-medium text-muted">
                {selected.month}월 {selected.day}일 {weekdayLabel(selected)}요일
              </h2>
              {selectedEvents.length === 0 ? (
                <p className="mt-3 rounded-2xl bg-[#f7f8fb] px-4 py-4 text-sm text-[#b0b4be]">
                  이 날의 일정이 없습니다
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {selectedEvents.map((item) => (
                    <li key={item.id ?? `${item.title}-${item.month}-${item.day}`}>
                      <EventCard item={item} date={selected} today={today} active />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          <EventGroup
            title="다가오는 일정"
            entries={upcoming}
            today={today}
            selected={selected}
            onOpen={openDate}
            empty="다가오는 일정이 없습니다"
            className={selected ? "mt-8" : ""}
          />
          <EventGroup
            title="지난 일정"
            entries={past}
            today={today}
            selected={selected}
            onOpen={openDate}
            empty="지난 일정이 없습니다"
            className="mt-8"
            muted
          />
        </div>
      </div>
    </div>
  );
}

function EventGroup({
  title,
  entries,
  today,
  selected,
  onOpen,
  empty,
  className,
  muted = false,
}: {
  title: string;
  entries: Array<{ item: ScheduleItem; date: CalendarDate }>;
  today: CalendarDate;
  selected: CalendarDate | null;
  onOpen: (date: CalendarDate) => void;
  empty: string;
  className?: string;
  muted?: boolean;
}) {
  return (
    <section className={className}>
      <h2 className="text-sm font-medium text-muted">
        {title} {entries.length}
      </h2>
      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-[#c5c8d0]">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {entries.map(({ item, date }) => (
            <li key={item.id ?? `${item.title}-${date.year}`}>
              <EventCard
                item={item}
                date={date}
                today={today}
                active={selected ? sameDate(selected, date) : false}
                muted={muted}
                onOpen={onOpen}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EventCard({
  item,
  date,
  today,
  active,
  muted = false,
  onOpen,
}: {
  item: ScheduleItem;
  date: CalendarDate;
  today: CalendarDate;
  active?: boolean;
  muted?: boolean;
  onOpen?: (date: CalendarDate) => void;
}) {
  const badge = (
    <span
      className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl ${
        muted ? "bg-[#f2f3f7] text-muted" : "bg-[#f3f0ff] text-violet"
      }`}
    >
      <span className="text-[11px] leading-none">{date.month}월</span>
      <span className="mt-1 text-lg font-bold leading-none">{date.day}</span>
    </span>
  );
  const copy = (
    <span className="min-w-0 flex-1 text-left">
      <span className="block text-[15px] font-medium">{item.title}</span>
      <span className="mt-1 block text-sm text-muted">
        {date.year}년 · {relativeLabel(today, date)}
      </span>
    </span>
  );
  const className = `flex w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left ${
    active ? "border-violet" : "border-line"
  }`;

  if (onOpen) {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => onOpen(date)}
          aria-label={`${date.month}월 ${date.day}일 달력에서 보기`}
          className="grid h-14 w-14 shrink-0 place-items-center"
        >
          {badge}
        </button>
        <EventLink item={item} className="flex min-w-0 flex-1 items-center gap-3">
          {copy}
          <Chevron direction="right" />
        </EventLink>
      </div>
    );
  }

  return (
    <EventLink item={item} className={className}>
      {badge}
      {copy}
      <Chevron direction="right" />
    </EventLink>
  );
}

function EventLink({
  item,
  className,
  children,
}: {
  item: ScheduleItem;
  className: string;
  children: ReactNode;
}) {
  if (item.href.startsWith("/")) {
    return (
      <Link href={item.href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={item.href} className={className}>
      {children}
    </a>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d={direction === "left" ? "M14.5 6.5 9 12l5.5 5.5" : "M9.5 6.5 15 12l-5.5 5.5"} />
    </svg>
  );
}

function sameDate(a: CalendarDate, b: CalendarDate) {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

function dayRank(date: CalendarDate) {
  return date.year * 10000 + date.month * 100 + date.day;
}
