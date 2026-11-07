"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { SettingsButton } from "@/components/settings-button";
import { members } from "@/content/members";
import { replyTargetLabel, replyText, type Post } from "@/content/posts";
import { isBookmarked, readBookmarks, subscribeBookmarks, toggleBookmark } from "@/lib/bookmarks";

export default function BookmarksPage() {
  const [rows, setRows] = useState<Post[]>([]);

  useEffect(() => {
    setRows(readBookmarks());
    return subscribeBookmarks(() => setRows(readBookmarks()));
  }, []);

  return (
    <div>
      <div className="flex items-start justify-between">
        <h1 className="text-[32px] font-bold tracking-tight">저장한 글</h1>
        <SettingsButton />
      </div>
      <p className="mt-1 text-[15px] text-muted">이 기기에만 저장됩니다</p>

      {rows.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-[#b0b4be]">저장한 글이 없습니다</p>
          <Link href="/posts" className="mt-4 inline-block text-sm font-medium text-violet">
            게시물 보러 가기
          </Link>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-line border-t border-line">
          {rows.map((post) => {
            const name = post.author ?? members.find((item) => item.slug === post.memberSlug)?.name;
            const body = replyText(post.title, post.replyTo);
            return (
              <li key={post.id} className="py-4">
                <div className="flex gap-3">
                  {post.memberSlug ? <ProfileAvatar slug={post.memberSlug} className="size-10" /> : null}
                  <div className="min-w-0 flex-1">
                    <a href={post.href} target="_blank" rel="noreferrer" className="block">
                      <span className="block text-sm">
                        <span className="font-medium">{name ?? platformLabel(post.platform)}</span>
                        <span className="text-muted"> · {post.date}</span>
                      </span>
                      {post.replyTo ? <span className="mt-0.5 block text-[13px] text-muted">{replyTargetLabel(post.replyTo)}에게</span> : null}
                      {body ? <span className="mt-1 block break-words text-[15px] leading-6">{body}</span> : null}
                    </a>
                    <button
                      type="button"
                      onClick={() => toggleBookmark(post)}
                      className="mt-3 text-sm font-medium text-violet"
                    >
                      {isBookmarked(post.id) ? "저장 해제" : "저장"}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function platformLabel(platform: Post["platform"]) {
  if (platform === "fanding") return "팬딩";
  if (platform === "cafe") return "카페";
  return "X";
}
