import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveBadge, LiveDot, LiveWatch } from "@/components/live-status";
import { OshiButton } from "@/components/oshi-button";
import { ProfileAvatar } from "@/components/profile-avatar";
import { SettingsButton } from "@/components/settings-button";
import {
  chzzkLiveUrl,
  getGraduate,
  getMember,
  graduates,
  members,
  shortName,
  unitName,
  unitTone,
  units,
  type Graduate,
} from "@/content/members";
import { posts, replyTargetLabel, replyText, type PostPlatform } from "@/content/posts";
import { trackPlatformLabel, trackStatsLabel, tracks } from "@/content/tracks";

export function generateStaticParams() {
  return [...members, ...graduates].map((member) => ({ slug: member.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const member = getMember(slug) ?? getGraduate(slug);
  return { title: member ? `${member.name} · Stella Now` : "Stella Now" };
}

export default async function MemberPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const graduate = getGraduate(slug);
  if (graduate) return <GraduatePage graduate={graduate} />;
  const member = getMember(slug);
  if (!member) notFound();

  const unit = units.find((item) => item.id === member.unit);
  const tone = unitTone[member.unit];
  const notes = memberPosts(member.slug);
  const songs = tracks.filter((track) => track.memberSlug === member.slug);
  const mates = members.filter((item) => item.unit === member.unit && item.slug !== member.slug);

  return (
    <article>
      <div className="flex items-center justify-between">
        <Link href="/members" className="text-sm font-medium text-muted">
          멤버
        </Link>
        <SettingsButton />
      </div>

      <div className="mt-4 md:grid md:grid-cols-[minmax(0,340px)_1fr] md:items-start md:gap-x-12">
        <div>
          <header className="rounded-3xl px-5 py-6" style={{ background: tone.surface }}>
            <div className="flex items-start gap-4">
              <span className="relative">
                <ProfileAvatar slug={member.slug} className="size-24 ring-4 ring-white" />
                <LiveDot slug={member.slug} className="absolute right-1 top-1 size-3.5 rounded-full border-2 border-white bg-[#ef3b3b]" />
              </span>
              <div className="min-w-0 pt-1">
                <p className="text-sm font-medium text-violet">{member.nameEn}</p>
                <h1 className="mt-1 flex flex-wrap items-center gap-2 text-[28px] font-bold leading-tight tracking-tight">
                  {member.name}
                  <LiveBadge slug={member.slug} />
                </h1>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: tone.wash, color: tone.text }}>
                    {unit?.gen}기 · {unitName(member.unit)}
                  </span>
                  {member.birthday ? (
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[#5c6270]">
                      생일 {member.birthday.month}월 {member.birthday.day}일
                    </span>
                  ) : null}
                  {member.fanName ? (
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[#5c6270]">
                      팬네임 {member.fanName}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <LiveWatch slug={member.slug} href={chzzkLiveUrl(member.chzzk)} />
          </header>

          {member.lore ? (
            <p className="mt-4 rounded-2xl border border-line px-4 py-4 text-sm leading-7 text-[#5c6270]">{member.lore}</p>
          ) : null}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Tile href={chzzkLiveUrl(member.chzzk)} label="치지직" primary />
            <Tile href={member.youtube} label="유튜브" external />
            <Tile href={member.x} label="X" external wide={!member.profile} />
            {member.profile ? <Tile href={member.profile} label="공식 프로필" external /> : null}
          </div>

          <div className="mt-2">
            <OshiButton slug={member.slug} />
          </div>
        </div>

        <div className="mt-8 md:mt-0">
          {songs.length > 0 ? (
            <section>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">음원</h2>
                <Link href="/music" className="text-sm font-medium text-violet">
                  더보기
                </Link>
              </div>
              <ul className="mt-3 space-y-2">
                {songs.slice(0, 6).map((track) => {
                  const stats = trackStatsLabel(track);
                  return (
                  <li key={track.id}>
                    <a href={track.href} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl bg-[#f2f3f7] px-3 py-3">
                      {track.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={track.thumb} alt="" className="size-14 shrink-0 rounded-xl object-cover" referrerPolicy="no-referrer" />
                      ) : null}
                      <span className="min-w-0">
                        <span className="block text-[11px] font-medium text-violet">
                          {track.kind === "cover" ? "커버" : "오리지널"}
                          {` · ${trackPlatformLabel(track)}`}
                          {track.date ? ` · ${track.date}` : ""}
                        </span>
                        <span className="mt-1 block line-clamp-2 text-[15px] font-medium leading-5">{track.title}</span>
                        {stats ? <span className="mt-1 block text-[12px] text-[#8b90a0]">{stats}</span> : null}
                      </span>
                    </a>
                  </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section className={songs.length > 0 ? "mt-8" : ""}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">최근 글</h2>
              <Link href={`/posts?member=${member.slug}`} className="text-sm font-medium text-violet">
                더보기
              </Link>
            </div>
            {notes.length === 0 ? (
              <p className="mt-3 text-sm text-muted">아직 가져온 글이 없습니다</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {notes.map((post) => {
                  const thumb = previewSrc(post.images?.[0] ?? post.videoPoster);
                  return (
                    <li key={post.id}>
                      <a href={post.href} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl bg-[#f2f3f7] px-3 py-3">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt="" className="size-16 shrink-0 rounded-xl object-cover" referrerPolicy="no-referrer" />
                        ) : null}
                        <span className="min-w-0">
                          <span className="block text-[11px] text-muted">
                            {platformLabel(post.platform)}
                            {post.replyTo ? ` · ${replyTargetLabel(post.replyTo)}에게` : ""} · {post.date}
                          </span>
                          <span className="mt-1 block line-clamp-2 text-sm leading-5">{replyText(post.title, post.replyTo) || post.title}</span>
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {mates.length > 0 ? (
            <section className="mt-8">
              <h2 className="text-lg font-bold">같은 기수</h2>
              <ul className="mt-3 flex gap-3 overflow-x-auto pb-1">
                {mates.map((mate) => (
                  <li key={mate.slug}>
                    <Link href={`/members/${mate.slug}`} className="flex w-16 flex-col items-center gap-2">
                      <ProfileAvatar slug={mate.slug} className="size-14" />
                      <span className="w-full truncate text-center text-xs">{shortName(mate.name)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function GraduatePage({ graduate }: { graduate: Graduate }) {
  return (
    <article>
      <div className="flex items-center justify-between">
        <Link href="/members" className="text-sm font-medium text-muted">
          멤버
        </Link>
        <SettingsButton />
      </div>
      <header className="mt-4 rounded-3xl bg-[#f7f8fb] px-5 py-6">
        <div className="flex items-start gap-4">
          <ProfileAvatar slug={graduate.slug} src={graduate.image} className="size-24" imageClassName="object-[center_18%]" />
          <div className="min-w-0 pt-1">
            <p className="text-sm font-medium text-violet">{graduate.nameEn}</p>
            <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight">{graduate.name}</h1>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[#5c6270]">
                {graduate.gen}기 · 졸업
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[#5c6270]">
                {graduate.graduated.year}년 {graduate.graduated.month}월 {graduate.graduated.day}일
              </span>
            </div>
          </div>
        </div>
      </header>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Tile href={graduate.notice} label="졸업 공지" external />
        <Tile href={graduate.page} label="졸업생 페이지" external />
      </div>
    </article>
  );
}

function Tile({
  href,
  label,
  primary = false,
  external = false,
  wide = false,
}: {
  href: string;
  label: string;
  primary?: boolean;
  external?: boolean;
  wide?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className={`flex h-12 items-center justify-center rounded-xl text-sm font-medium ${wide ? "col-span-2" : ""} ${
        primary ? "bg-violet text-white" : "border border-line bg-white"
      }`}
    >
      {label}
    </a>
  );
}

function memberPosts(slug: string) {
  const own = posts
    .filter((post) => post.memberSlug === slug)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const notes = own.filter((post) => !post.replyTo);
  return (notes.length >= 3 ? notes : own).slice(0, 4);
}

function platformLabel(platform: PostPlatform) {
  if (platform === "fanding") return "팬딩";
  if (platform === "cafe") return "카페";
  return "X";
}

function previewSrc(src?: string) {
  if (!src) return null;
  return src.includes("name=orig") ? src.replace("name=orig", "name=small") : src;
}
