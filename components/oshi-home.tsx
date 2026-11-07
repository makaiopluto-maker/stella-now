"use client";

import Link from "next/link";
import { LiveBadge, LiveDot, useLiveStatuses } from "@/components/live-status";
import { useOshi } from "@/components/oshi";
import { ProfileAvatar } from "@/components/profile-avatar";
import { chzzkLiveUrl, getMember, shortName } from "@/content/members";
import { posts } from "@/content/posts";

export function OshiHome() {
  const { slug } = useOshi();
  const { statuses } = useLiveStatuses();
  const member = slug ? getMember(slug) : null;
  if (!member) return null;

  const live = Boolean(statuses[member.slug]?.live);
  const recent = posts.filter((post) => post.memberSlug === member.slug).slice(0, 3);

  return (
    <section className="mt-6 rounded-2xl border border-[#d9dde6] px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-violet">내 오시</p>
          <Link href={`/members/${member.slug}`} className="mt-3 flex items-center gap-3">
            <span className="relative">
              <ProfileAvatar slug={member.slug} className="size-12" />
              <LiveDot slug={member.slug} className="absolute right-0 top-0 size-3 rounded-full border-2 border-white bg-[#ef3b3b]" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-[16px] font-bold">
                {member.name}
                <LiveBadge slug={member.slug} />
              </span>
              <span className="mt-0.5 block text-sm text-muted">{live ? "지금 방송 중" : `${shortName(member.name)}의 최근 소식`}</span>
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
      {recent.length > 0 ? (
        <ul className="mt-4 space-y-2 border-t border-line pt-4">
          {recent.map((post) => (
            <li key={post.id}>
              <a href={post.href} target="_blank" rel="noreferrer" className="block">
                <p className="text-xs text-muted">{post.date}</p>
                <p className="mt-0.5 line-clamp-2 text-[14px] leading-5">{post.title}</p>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
