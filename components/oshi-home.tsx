"use client";

import Link from "next/link";
import { LiveBadge, LiveDot, broadcastLine, useLiveStatuses } from "@/components/live-status";
import { useOshi } from "@/components/oshi";
import { ProfileAvatar } from "@/components/profile-avatar";
import { chzzkLiveUrl, getMember, shortName } from "@/content/members";
import { posts } from "@/content/posts";
import {
  occurrence,
  relativeLabel,
  schedule,
  seoulToday,
  dateValue,
} from "@/content/schedule";
import { trackArtistName, trackPlatformLabel, tracks } from "@/content/tracks";

export function OshiHome() {
  const { slug } = useOshi();
  const { statuses, now } = useLiveStatuses();
  const member = slug ? getMember(slug) : null;
  if (!member) return null;

  const info = statuses[member.slug];
  const live = Boolean(info?.live);
  const recent = posts.filter((post) => post.memberSlug === member.slug).slice(0, 3);
  const today = seoulToday();
  const upcoming = schedule
    .map((item) => ({ item, date: occurrence(item, today) }))
    .filter(({ item, date }) => {
      if (dateValue(date) < dateValue(today)) return false;
      if (item.href === `/members/${member.slug}`) return true;
      return item.title.includes(shortName(member.name)) || item.title.includes(member.name);
    })
    .sort((a, b) => dateValue(a.date) - dateValue(b.date))
    .slice(0, 2);
  const music = tracks.filter((track) => track.memberSlug === member.slug).slice(0, 3);

  return (
    <section className="mt-6 rounded-2xl border border-line px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-violet">내 오시</p>
          <Link href={`/members/${member.slug}`} className="mt-3 flex items-center gap-3">
            <span className="relative">
              <ProfileAvatar slug={member.slug} className="size-12" />
              <LiveDot slug={member.slug} className="absolute right-0 top-0 size-3 rounded-full border-2 border-paper bg-[#ef3b3b]" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-[16px] font-bold">
                {member.name}
                <LiveBadge slug={member.slug} />
              </span>
              <span className="mt-0.5 block text-sm text-muted">
                {live
                  ? broadcastLine(info?.openDate ?? null, info?.viewers ?? 0, now)
                  : `${shortName(member.name)}의 최근 소식`}
              </span>
            </span>
          </Link>
        </div>
        {live ? (
          <a href={chzzkLiveUrl(member.chzzk)} className="shrink-0 text-sm font-medium text-[#ef3b3b]">
            시청
          </a>
        ) : (
          <Link href={`/posts?member=${member.slug}`} className="shrink-0 text-sm font-medium text-violet">
            더보기
          </Link>
        )}
      </div>

      {upcoming.length > 0 ? (
        <div className="mt-4 border-t border-line pt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">다음 일정</p>
            <Link href="/calendar" className="text-xs font-medium text-violet">
              일정
            </Link>
          </div>
          <ul className="mt-2 space-y-2">
            {upcoming.map(({ item, date }) => (
              <li key={`${item.title}-${date.year}-${date.month}-${date.day}`}>
                <Link href={item.href.startsWith("/") ? item.href : "/calendar"} className="block">
                  <p className="text-xs text-muted">
                    {date.month}/{date.day} · {relativeLabel(today, date)}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-[14px] leading-5">{item.title}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {recent.length > 0 ? (
        <div className="mt-4 border-t border-line pt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">최근 글</p>
            <Link href={`/posts?member=${member.slug}`} className="text-xs font-medium text-violet">
              게시물
            </Link>
          </div>
          <ul className="mt-2 space-y-2">
            {recent.map((post) => (
              <li key={post.id}>
                <a href={post.href} target="_blank" rel="noreferrer" className="block">
                  <p className="text-xs text-muted">{post.date}</p>
                  <p className="mt-0.5 line-clamp-2 text-[14px] leading-5">{post.title}</p>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {music.length > 0 ? (
        <div className="mt-4 border-t border-line pt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">음원</p>
            <Link href="/music" className="text-xs font-medium text-violet">
              더보기
            </Link>
          </div>
          <ul className="mt-2 space-y-2">
            {music.map((track) => (
              <li key={track.id}>
                <Link href="/music" className="block">
                  <p className="text-xs text-muted">
                    {track.kind === "cover" ? "커버" : "오리지널"} · {trackPlatformLabel(track)}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-[14px] leading-5">{track.title}</p>
                  <p className="text-xs text-muted">{trackArtistName(track.memberSlug)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
