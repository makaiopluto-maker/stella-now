import Link from "next/link";
import type { ReactNode } from "react";
import { LiveNow } from "@/components/live-now";
import { OshiHome } from "@/components/oshi-home";
import { posts } from "@/content/posts";
import { trackArtistName, trackPlatformLabel, tracks } from "@/content/tracks";

export default function HomePage() {
  return (
    <div>
      <div className="flex items-start justify-between md:hidden">
        <h1 className="text-[34px] font-bold leading-none tracking-tight sm:text-[40px]">Stella Now</h1>
        <Link href="/settings" aria-label="설정" className="grid size-10 place-items-center text-ink">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3.6v2.1M12 18.3v2.1M4.8 6.6l1.5 1.5M17.7 15.9l1.5 1.5M3.6 12h2.1M18.3 12h2.1M4.8 17.4l1.5-1.5M17.7 8.1l1.5-1.5" />
          </svg>
        </Link>
      </div>
      <p className="mt-2 text-[15px] text-muted md:mt-0">스텔라이브 최신 소식</p>

      <section className="mt-6 rounded-2xl border border-[#d9dde6] px-5 py-5">
        <LiveNow />
      </section>

      <OshiHome />

      <div className="md:grid md:grid-cols-2 md:gap-x-12">
      <Section title="공지사항" href="/posts?platform=cafe">
        {notices.length === 0 ? (
          <Empty label="공지사항이 없습니다" />
        ) : (
          <ul className="space-y-3">
            {notices.map((post) => (
              <li key={post.id}>
                <a href={post.href} target="_blank" rel="noreferrer" className="block">
                  <p className="text-xs text-muted">{post.date}</p>
                  <p className="mt-0.5 line-clamp-2 text-[15px] font-medium leading-6">{post.title}</p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="최근 음원" href="/music">
        {recentTracks.length === 0 ? (
          <Empty label="모은 음원이 없습니다" />
        ) : (
          <ul className="space-y-3">
            {recentTracks.map((track) => {
              const artist = trackArtistName(track.memberSlug);
              return (
                <li key={track.id}>
                  <a href={track.href} target="_blank" rel="noreferrer" className="block">
                    <p className="text-xs text-muted">
                      {track.kind === "cover" ? "커버" : "오리지널"}
                      {` · ${trackPlatformLabel(track)}`}
                      {track.date ? ` · ${track.date}` : ""}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[15px] font-medium leading-6">{track.title}</p>
                    <p className="text-sm text-muted">{artist}</p>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
      </div>
    </div>
  );
}

const notices = posts.filter((post) => post.platform === "cafe").slice(0, 4);
const recentTracks = tracks.slice(0, 4);

function Section({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-9">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{title}</h2>
        <Link href={href} className="text-sm font-medium text-violet">
          더보기
        </Link>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="py-8 text-center text-sm text-[#c5c8d0]">{label}</p>;
}
