"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { fanartTags, members, shortName } from "@/content/members";
import { posts, replyTargetLabel, replyText, type Post, type PostPlatform } from "@/content/posts";
import { ExternalLink } from "@/components/external-link";
import { isBookmarked, subscribeBookmarks, toggleBookmark } from "@/lib/bookmarks";
import { saveRemoteFile } from "@/lib/save-file";
import { fetchCafeNoticePage } from "@/lib/cafe-notices";
import { fetchFandingPage } from "@/lib/fanding-posts";
import { markNoticesSeen } from "@/lib/notice-badge";
import { readFlag, subscribePref } from "@/lib/prefs";
import { flushTweetArchive, readTweetArchive, rememberTweets } from "@/lib/tweet-cache";
import { fetchOwnPosts, fetchTaggedPosts, fetchTweetCount } from "@/lib/x-timeline";

const hideRepliesKey = "stella-now-hide-replies";

const platforms = [
  { id: "all", label: "전체" },
  { id: "fanding", label: "팬딩" },
  { id: "cafe", label: "카페" },
  { id: "x", label: "X" },
] as const;

type PlatformFilter = (typeof platforms)[number]["id"];

export function PostFeed() {
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [query, setQuery] = useState("");
  const [member, setMember] = useState("all");
  const [tag, setTag] = useState("all");
  const [fresh, setFresh] = useState<Post[]>([]);
  const [cursors, setCursors] = useState<Record<string, string | null>>({});
  const [totals, setTotals] = useState<Record<string, number>>({});
  const cursorRef = useRef<Record<string, string | null>>({});
  const priorityRef = useRef("all");
  const [loaded, setLoaded] = useState(false);
  const [walkId, setWalkId] = useState(0);
  const [paging, setPaging] = useState(false);
  const [cafePaging, setCafePaging] = useState(false);
  const [fandingPaging, setFandingPaging] = useState(false);
  const [tagPaging, setTagPaging] = useState(false);
  const [shown, setShown] = useState(40);
  const [viewer, setViewer] = useState<MediaFile | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [routeReady, setRouteReady] = useState(false);
  const [restored, setRestored] = useState(false);
  const [hideReplies, setHideReplies] = useState(false);
  const [bookmarkTick, setBookmarkTick] = useState(0);
  const [savedOnly, setSavedOnly] = useState(false);
  const keptHistory = useRef(false);
  const wantTweets = routeReady && member !== "none" && (tag === "all" || tag === "none");
  priorityRef.current = member === "none" ? "all" : member;

  async function save(file: MediaFile) {
    try {
      await saveRemoteFile(file.fileUrl, file.filename);
      setNotice("저장을 시작했어요");
    } catch {
      window.open(file.fileUrl, "_blank", "noopener");
      setNotice("저장 화면을 열었어요");
    }
    window.setTimeout(() => setNotice(null), 2000);
  }

  useEffect(() => {
    let cancel = false;
    void readTweetArchive().then((archive) => {
      if (cancel) return;
      if (archive.posts.length > 0 || Object.keys(archive.cursors).length > 0) {
        keptHistory.current = true;
        cursorRef.current = { ...archive.cursors };
        setFresh((current) => mergePosts(archive.posts, current));
        setCursors({ ...cursorRef.current });
        setLoaded(true);
      }
      setRestored(true);
    });
    function save() {
      flushTweetArchive();
    }
    function onHidden() {
      if (document.visibilityState === "hidden") save();
    }
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      cancel = true;
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", onHidden);
      save();
    };
  }, []);

  useEffect(() => {
    if (!restored) return;
    let stop = false;
    const known = new Set(posts.filter((post) => post.platform === "cafe").map((post) => post.id));
    void (async () => {
      const archive = await readTweetArchive();
      if (stop) return;
      for (const post of archive.posts) if (post.platform === "cafe") known.add(post.id);
      const saved = archive.cursors["cafe-page"];
      const done = Object.prototype.hasOwnProperty.call(archive.cursors, "cafe-page") && saved === null;
      let page = done ? 1 : Number(saved) || 1;
      if (!done) setCafePaging(true);
      try {
        while (!stop && page <= 40) {
          const result = await fetchCafeNoticePage(page);
          if (stop) return;
          const novel = result.posts.filter((post) => !known.has(post.id));
          for (const post of result.posts) known.add(post.id);
          const next = !done && result.hasNext ? String(page + 1) : null;
          cursorRef.current["cafe-page"] = next;
          if (novel.length > 0) setFresh((current) => mergePosts(novel, current));
          rememberTweets(novel, { "cafe-page": next });
          if (!result.hasNext || (done && novel.length === 0)) break;
          if (done) break;
          page += 1;
        }
      } catch {
        // A failed page keeps the saved place. It must not mark the board finished.
      }
      if (!stop) setCafePaging(false);
    })();
    return () => {
      stop = true;
    };
  }, [restored]);

  useEffect(() => {
    if (!restored) return;
    let stop = false;
    const known = new Set(posts.filter((post) => post.platform === "fanding").map((post) => post.id));
    void (async () => {
      const archive = await readTweetArchive();
      if (stop) return;
      for (const post of archive.posts) if (post.platform === "fanding") known.add(post.id);
      const saved = archive.cursors["fanding-all"];
      const done = Object.prototype.hasOwnProperty.call(archive.cursors, "fanding-all") && saved === null;
      let cursor = done ? undefined : saved || undefined;
      if (!done) setFandingPaging(true);
      try {
        while (!stop) {
          const result = await fetchFandingPage(cursor);
          if (stop) return;
          const novel = result.posts.filter((post) => !known.has(post.id));
          for (const post of result.posts) known.add(post.id);
          const next = !done && result.next ? result.next : null;
          cursorRef.current["fanding-all"] = next;
          if (novel.length > 0) setFresh((current) => mergePosts(novel, current));
          rememberTweets(novel, { "fanding-all": next });
          if (!result.next || (done && novel.length === 0)) break;
          if (done) break;
          cursor = result.next;
        }
      } catch {
        // A failed page keeps the saved place. It must not mark the board finished.
      }
      if (!stop) setFandingPaging(false);
    })();
    return () => {
      stop = true;
    };
  }, [restored]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("member");
    if (slug && members.some((item) => item.slug === slug)) setMember(slug);
    const requested = params.get("platform");
    if (requested === "fanding" || requested === "cafe" || requested === "x") setPlatform(requested);
    setHideReplies(readFlag(hideRepliesKey));
    markNoticesSeen();
    setRouteReady(true);
    const stopHide = subscribePref(hideRepliesKey, () => setHideReplies(readFlag(hideRepliesKey)));
    const stopBooks = subscribeBookmarks(() => setBookmarkTick((value) => value + 1));
    return () => {
      stopHide();
      stopBooks();
    };
  }, []);

  useEffect(() => {
    if (!filtersOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setFiltersOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtersOpen]);

  useEffect(() => {
    setShown(40);
    document.querySelector("main")?.scrollTo({ top: 0 });
  }, [member, tag, platform, query]);

  useEffect(() => {
    if (!wantTweets || !loaded) return;
    let cancel = false;
    void Promise.all(
      members.map(async (item) => {
        const handle = item.x.split("/").filter(Boolean).pop() ?? "";
        const count = await fetchTweetCount(handle);
        return [item.slug, count ?? 0] as const;
      }),
    ).then((rows) => {
      if (cancel) return;
      setTotals(Object.fromEntries(rows));
    });
    return () => {
      cancel = true;
    };
  }, [wantTweets, loaded]);

  useEffect(() => {
    if (tag === "all" || tag === "none") return;
    const slug = fanartTags.find((item) => item.tag === tag)?.slug;
    let stop = false;
    setTagPaging(true);
    void (async () => {
      let cursor: string | undefined;
      const seen = new Set<string>();
      const seenIds = new Set<string>();
      let empty = 0;
      while (!stop && empty < 2) {
        const page = await fetchTaggedPosts(tag, slug, cursor);
        if (stop) return;
        const novel = page.posts.filter((post) => !seenIds.has(post.id));
        for (const post of page.posts) seenIds.add(post.id);
        if (novel.length > 0) {
          empty = 0;
          setFresh((current) => mergePosts(novel, current));
        } else {
          empty += 1;
        }
        if (!page.cursor || seen.has(page.cursor)) break;
        seen.add(page.cursor);
        cursor = page.cursor;
      }
      if (!stop) setTagPaging(false);
    })();
    return () => {
      stop = true;
    };
  }, [tag]);

  useEffect(() => {
    if (!restored || !wantTweets || loaded || keptHistory.current) return;
    let cancel = false;
    void loadPages(members, {}).then((page) => {
      if (cancel) return;
      for (const [slug, cursor] of Object.entries(page.cursors)) {
        if (cursorRef.current[slug] === undefined) cursorRef.current[slug] = cursor;
      }
      setFresh((current) => mergePosts(page.posts, current));
      setCursors({ ...cursorRef.current });
      rememberTweets(page.posts, { ...cursorRef.current });
      setLoaded(true);
    });
    return () => {
      cancel = true;
    };
  }, [restored, wantTweets, loaded]);

  useEffect(() => {
    if (!restored || !wantTweets || !keptHistory.current) return;
    let cancel = false;
    void loadPages(members, {}).then((page) => {
      if (cancel) return;
      setFresh((current) => mergePosts(page.posts, current));
      rememberTweets(page.posts, {});
    });
    return () => {
      cancel = true;
    };
  }, [restored, wantTweets]);

  useEffect(() => {
    if (!loaded || !wantTweets) {
      setPaging(false);
      return;
    }
    // Saved history stays on the device. Opening the app only checks for new posts;
    // older pages resume when the user asks for more.
    if (keptHistory.current && walkId === 0) {
      setPaging(false);
      return;
    }
    let stop = false;
    const batch: Post[] = [];
    const seenCursor: Record<string, Set<string>> = {};
    const seenIds: Record<string, Set<string>> = {};
    const fails: Record<string, number> = {};
    let lastFlush = Date.now();
    let busy = false;

    function setBusy(next: boolean) {
      if (busy === next) return;
      busy = next;
      setPaging(next);
    }

    function flush(force = false) {
      if (batch.length === 0) {
        if (force) {
          rememberTweets([], { ...cursorRef.current });
          flushTweetArchive();
        }
        return;
      }
      if (!force && Date.now() - lastFlush < 150) return;
      const incoming = batch.splice(0, batch.length);
      lastFlush = Date.now();
      setFresh((current) => mergePosts(incoming, current));
      setCursors({ ...cursorRef.current });
      rememberTweets(incoming, { ...cursorRef.current });
      if (force) flushTweetArchive();
    }

    async function pull(slug: string): Promise<"more" | "done" | "pause"> {
      const item = members.find((person) => person.slug === slug);
      const current = cursorRef.current[slug];
      if (!item || !current) return "done";
      seenCursor[slug] ??= new Set();
      if (seenCursor[slug].has(current)) {
        cursorRef.current[slug] = null;
        return "done";
      }
      seenCursor[slug].add(current);
      const handle = item.x.split("/").filter(Boolean).pop() ?? "";
      try {
        const page = await fetchOwnPosts(handle, slug, current);
        fails[slug] = 0;
        seenIds[slug] ??= new Set();
        const novel = page.posts.filter((post) => !seenIds[slug].has(post.id));
        for (const post of page.posts) seenIds[slug].add(post.id);
        if (novel.length > 0) batch.push(...novel);
        const next = page.cursor ?? null;
        const stuck = !next || next === current || (page.posts.length > 0 && novel.length === 0);
        cursorRef.current[slug] = stuck ? null : next;
        if (stop) {
          flush(true);
          return "pause";
        }
        return stuck ? "done" : "more";
      } catch {
        fails[slug] = (fails[slug] ?? 0) + 1;
        if (fails[slug] >= 5) return "pause";
        await new Promise((resolve) => setTimeout(resolve, 800));
        return "more";
      }
    }

    void (async () => {
      const queue = members.map((item) => item.slug).filter((slug) => cursorRef.current[slug]);
      const preferred = priorityRef.current;
      if (preferred !== "all") {
        const index = queue.indexOf(preferred);
        if (index > 0) queue.unshift(queue.splice(index, 1)[0]);
      }
      setBusy(queue.length > 0);
      await Promise.all(
        queue.map(async (slug) => {
          while (!stop) {
            const result = await pull(slug);
            if (stop) return;
            flush();
            if (result !== "more") return;
          }
        }),
      );
      flush(true);
      if (!stop) setBusy(false);
    })();

    return () => {
      stop = true;
      flush(true);
    };
  }, [loaded, walkId, wantTweets]);

  const feed = useMemo(() => mergePosts(posts, fresh), [fresh]);
  const counts = useMemo(() => {
    const scoped = feed.filter((post) => matchesScope(post, member, tag));
    return {
      all: scoped.length,
      fanding: scoped.filter((post) => post.platform === "fanding").length,
      cafe: scoped.filter((post) => post.platform === "cafe").length,
      x: scoped.filter((post) => post.platform === "x").length,
    };
  }, [feed, member, tag]);
  const loadedTweets = feed.filter((post) => post.platform === "x" && !isFanartPost(post) && (member === "all" || member === "none" || post.memberSlug === member)).length;
  const scopeTotal = member === "all" || member === "none" ? members.reduce((sum, item) => sum + (totals[item.slug] ?? 0), 0) : (totals[member] ?? 0);
  const totalsReady = member === "all" || member === "none" ? members.every((item) => totals[item.slug] !== undefined) : totals[member] !== undefined;

  void bookmarkTick;
  const visible = feed.filter((post) => {
    if (!matchesScope(post, member, tag)) return false;
    if (platform !== "all" && post.platform !== platform) return false;
    if (!matchesQuery(post, query)) return false;
    if (hideReplies && post.replyTo) return false;
    if (savedOnly && !isBookmarked(post.id)) return false;
    return true;
  });

  const historyTargets = members.filter((item) => member === "all" || item.slug === member);
  const showTweetHistory = member !== "none" && (tag === "all" || tag === "none") && (platform === "all" || platform === "x");
  const canLoadMore = loaded && !paging && showTweetHistory && historyTargets.some((item) => cursors[item.slug]);
  const historyEnded = loaded && !paging && showTweetHistory && historyTargets.length > 0 && historyTargets.every((item) => cursors[item.slug] === null);
  const rows = visible.slice(0, shown);

  function loadMore() {
    if (paging) return;
    setWalkId((id) => id + 1);
  }

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden">
      <div className="flex items-start justify-between">
        <h1 className="text-[32px] font-bold tracking-tight">게시물</h1>
        <Link href="/settings" aria-label="설정" className="grid size-10 place-items-center text-ink md:hidden">
          <GearIcon />
        </Link>
      </div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="text-[15px] text-muted">스텔라이브 최신 소식</p>
        <button
          type="button"
          aria-label="필터"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen(true)}
          className="relative grid size-11 shrink-0 place-items-center rounded-full border-2 border-[#8d96a8] bg-white text-ink"
        >
          <FilterIcon />
          {platform !== "all" || (member !== "all" && member !== "none") || (tag !== "all" && tag !== "none") ? (
            <span className="absolute right-0 top-0 size-2.5 rounded-full bg-violet" />
          ) : null}
        </button>
      </div>
      <div className="mt-4 flex h-14 items-center gap-3 rounded-2xl bg-[#f2f3f7] px-4">
        <SearchIcon />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="게시물 검색"
          placeholder="게시물 검색"
          className="w-full bg-transparent text-[15px] outline-none placeholder:text-[#b0b4be]"
        />
        {query ? (
          <button type="button" onClick={() => setQuery("")} className="shrink-0 text-sm font-medium text-muted">
            지우기
          </button>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {platforms.map((item) => (
          <FilterChip key={item.id} active={platform === item.id} label={item.label} onClick={() => setPlatform(item.id)} />
        ))}
        <FilterChip active={savedOnly} label="저장" onClick={() => setSavedOnly((value) => !value)} />
      </div>
      {hideReplies ? <p className="mt-3 text-sm text-muted">답글을 숨기고 있어요. 설정에서 끌 수 있습니다.</p> : null}
      {(member !== "all" && member !== "none") || (tag !== "all" && tag !== "none") ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {member !== "all" && member !== "none" ? <FilterChip active label={members.find((item) => item.slug === member)?.name ?? member} onClick={() => setMember("all")} /> : null}
          {tag !== "all" && tag !== "none" ? <FilterChip active label={tag} onClick={() => setTag("all")} /> : null}
        </div>
      ) : null}
      {showTweetHistory && restored && totalsReady && scopeTotal > 0 ? (
        <p className="mt-3 text-sm leading-6 text-muted">
          {member === "all" ? "멤버 계정" : "이 계정"}에 있는 글은 {scopeTotal.toLocaleString("ko-KR")}개입니다. 지금까지 직접 쓴 글 {loadedTweets.toLocaleString("ko-KR")}개를 불러왔습니다.
          {paging ? " 이전 글을 이어서 가져오는 중입니다." : ""}
        </p>
      ) : null}
      {cafePaging ? (
        <p className="mt-3 text-sm leading-6 text-muted">카페 공지를 가져오는 중 · {counts.cafe.toLocaleString("ko-KR")}개</p>
      ) : null}
      {fandingPaging ? (
        <p className="mt-3 text-sm leading-6 text-muted">팬딩 글을 가져오는 중 · {counts.fanding.toLocaleString("ko-KR")}개</p>
      ) : null}

      {filtersOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 md:items-center" onClick={() => setFiltersOpen(false)}>
          <div
            role="dialog"
            aria-label="필터"
            className="max-h-[80dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white px-5 pb-8 pt-5 md:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">필터</h2>
              <button type="button" onClick={() => setFiltersOpen(false)} className="text-sm font-medium text-muted">
                닫기
              </button>
            </div>
            <p className="mt-5 text-sm text-muted">플랫폼</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {platforms.map((item) => (
                <FilterChip
                  key={item.id}
                  active={platform === item.id}
                  label={`${item.label} (${counts[item.id]})`}
                  onClick={() => setPlatform(item.id)}
                />
              ))}
            </div>
            {showTweetHistory && totalsReady && scopeTotal > 0 ? (
              <p className="mt-3 text-sm leading-6 text-muted">
                {member === "all" ? "멤버 계정" : "이 계정"}에 있는 글은 {scopeTotal.toLocaleString("ko-KR")}개입니다. 화면의 숫자는 지금까지 불러온 직접 쓴 글입니다.
              </p>
            ) : null}
            <p className="mt-5 text-sm text-muted">멤버</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <FilterChip active={member === "all"} label="전체" onClick={() => setMember(member === "all" ? "none" : "all")} />
              {members.map((item) => (
                <FilterChip
                  key={item.slug}
                  active={member === item.slug}
                  label={item.name}
                  onClick={() => setMember(member === item.slug ? "none" : item.slug)}
                />
              ))}
            </div>
            <p className="mt-5 text-sm text-muted">팬아트</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <FilterChip active={tag === "all"} label="전체" onClick={() => setTag(tag === "all" ? "none" : "all")} />
              {fanartTags.map((item) => (
                <FilterChip
                  key={item.tag}
                  active={tag === item.tag}
                  label={`${shortName(members.find((person) => person.slug === item.slug)?.name ?? item.slug)} ${item.tag}`}
                  onClick={() => setTag(tag === item.tag ? "none" : item.tag)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-[#b0b4be]">
            {query.trim() ? "검색 결과가 없습니다" : tagPaging || (paging && member !== "none") ? "글을 가져오는 중" : "게시물이 없습니다"}
          </p>
          {tag !== "all" && tag !== "none" && !tagPaging ? (
            <ExternalLink
              href={`https://x.com/search?q=${encodeURIComponent(tag)}&src=typed_query&f=live`}
              className="mt-4 inline-block text-sm font-medium text-violet"
            >
              X에서 {tag} 보기
            </ExternalLink>
          ) : null}
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-line border-t border-line">
          {rows.map((post) => (
            <PostRow
              key={post.id}
              post={post}
              onOpen={setViewer}
              onSave={(file) => void save(file)}
            />
          ))}
        </ul>
      )}
      {shown < visible.length ? <LoadTail onReach={() => setShown((count) => count + 40)} /> : null}

      {paging && rows.length > 0 && showTweetHistory ? (
        <p className="mt-4 text-center text-sm text-muted">이전 글을 가져오는 중 · {loadedTweets.toLocaleString("ko-KR")}개</p>
      ) : null}
      {canLoadMore ? (
        <button
          type="button"
          onClick={loadMore}
          className="mt-4 w-full py-3 text-[15px] font-medium text-violet"
        >
          이전 게시물 더 보기
        </button>
      ) : null}
      {historyEnded ? <p className="mt-4 text-center text-sm text-muted">마지막 게시물입니다</p> : null}

      {notice ? <p className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-white">{notice}</p> : null}

      {viewer ? (
        <div className="fixed inset-0 z-[80] flex flex-col bg-black" onClick={() => setViewer(null)}>
          <div className="flex min-h-0 flex-1 items-center justify-center px-3">
            <img
              src={viewer.src}
              alt=""
              referrerPolicy={imageReferrer(viewer.src)}
              className="h-auto w-auto max-h-[calc(100dvh-5rem)] max-w-full object-contain"
              onClick={(event) => event.stopPropagation()}
            />
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void save(viewer);
            }}
            className="mb-[max(16px,env(safe-area-inset-bottom))] self-center rounded-full bg-white px-5 py-2 text-sm font-medium text-ink"
          >
            저장
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PostRow({
  post,
  onOpen,
  onSave,
}: {
  post: Post;
  onOpen: (file: MediaFile) => void;
  onSave: (file: MediaFile) => void;
}) {
  const name = post.author ?? members.find((item) => item.slug === post.memberSlug)?.name;
  const pictures = mediaFiles(post);
  const body = replyText(post.title, post.replyTo);

  return (
    <li className="py-4">
      <div className={`flex gap-3 ${post.replyTo ? "ml-5 border-l-2 border-line pl-3" : ""}`}>
        {post.memberSlug ? <ProfileAvatar slug={post.memberSlug} className={post.replyTo ? "size-8" : "size-10"} /> : null}
        <div className="min-w-0 flex-1">
          <a href={post.href} target="_blank" rel="noreferrer" className="block">
            <span className="block text-sm">
              <span className="font-medium">{name ?? platformLabel(post.platform)}</span>
              <span className="text-muted"> · {post.date}</span>
            </span>
            {post.replyTo ? <span className="mt-0.5 block break-words text-[13px] text-muted">{replyTargetLabel(post.replyTo)}에게</span> : null}
            {body ? <span className="mt-1 block break-words text-[15px] leading-6">{body}</span> : null}
          </a>
          {pictures.length > 0 ? (
            <div className={`mt-2 grid gap-1 ${pictures.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {pictures.map((picture) => (
                <div key={picture.src} className="relative overflow-hidden rounded-xl">
                  <button type="button" onClick={() => onOpen(picture)} className="block w-full">
                    <img src={previewSrc(picture.src)} alt="" referrerPolicy={imageReferrer(picture.src)} className="block h-auto w-full max-w-full" />
                  </button>
                  {picture.video ? (
                    <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white">
                      영상
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onSave(picture)}
                    className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white"
                  >
                    저장
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <BookmarkButton post={post} />
            {post.platform === "x" && /^\d+$/.test(post.id) ? (
              <>
                <ExternalLink href={`https://x.com/intent/retweet?tweet_id=${post.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-[#f2f3f7] px-3 py-1.5 text-sm font-medium text-ink">
                  <RepostIcon />
                  리트윗
                </ExternalLink>
                <ExternalLink href={`https://x.com/intent/like?tweet_id=${post.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-[#f2f3f7] px-3 py-1.5 text-sm font-medium text-ink">
                  <HeartIcon />
                  하트
                </ExternalLink>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

type MediaFile = { src: string; fileUrl: string; filename: string; video: boolean };

function mediaFiles(post: Post): MediaFile[] {
  const images = (post.images ?? []).map((src) => ({
    src,
    fileUrl: src,
    filename: fileName(src, "jpg"),
    video: false,
  }));
  if (!post.videoPoster) return images;
  const fileUrl = post.videoUrl || post.videoPoster;
  return [
    ...images,
    {
      src: post.videoPoster,
      fileUrl,
      filename: post.videoUrl ? fileName(post.videoUrl, "mp4") : fileName(post.videoPoster, "jpg"),
      video: true,
    },
  ];
}

function fileName(url: string, fallbackExt: string) {
  const name = url.split("?")[0]?.split("/").pop() || `stella-now.${fallbackExt}`;
  return name.includes(".") ? name : `${name}.${fallbackExt}`;
}

async function loadPages(targets: { slug: string; x: string }[], cursors: Record<string, string | null>) {
  const posts: Post[] = [];
  const next: Record<string, string | null> = {};
  await Promise.all(
    targets.map(async (item) => {
      const handle = item.x.split("/").filter(Boolean).pop() ?? "";
      try {
        const page = await fetchOwnPosts(handle, item.slug, cursors[item.slug] || undefined);
        posts.push(...page.posts);
        next[item.slug] = page.cursor ?? null;
      } catch {
        if (cursors[item.slug]) next[item.slug] = cursors[item.slug];
      }
    }),
  );
  return { posts, cursors: next };
}

function matchesQuery(post: Post, query: string) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const person = members.find((item) => item.slug === post.memberSlug);
  const haystack = [
    post.title,
    replyText(post.title, post.replyTo),
    post.author,
    post.date,
    person?.name,
    person?.nameEn,
    person ? shortName(person.name) : "",
    post.replyTo ? replyTargetLabel(post.replyTo) : "",
    platformLabel(post.platform),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function matchesScope(post: Post, member: string, tag: string) {
  const fanart = isFanartPost(post);
  if (fanart) {
    if (tag === "none") return false;
    if (tag !== "all" && !hasTag(post.title, tag)) return false;
  } else if (post.platform === "x" && member === "none") {
    return false;
  } else if (tag !== "all" && tag !== "none") {
    return false;
  }
  return member === "all" || member === "none" || post.memberSlug === member;
}

function isFanartPost(post: Post) {
  return Boolean(post.fanart) || fanartTags.some((item) => hasTag(post.title, item.tag));
}

function hasTag(title: string, tag: string) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\w가-힣])${escaped}(?![\\w가-힣])`, "i").test(title);
}

function mergePosts(saved: Post[], incoming: Post[]) {
  const map = new Map(saved.map((post) => [post.id, post]));
  for (const post of incoming) map.set(post.id, { ...map.get(post.id), ...post });
  return [...map.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function previewSrc(src: string) {
  return src.replace("name=orig", "name=small");
}

function imageReferrer(src: string) {
  return src.includes("pstatic.net") ? "no-referrer" : undefined;
}

function LoadTail({ onReach }: { onReach: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let done = false;
    const observer = new IntersectionObserver((entries) => {
      if (done || !entries.some((entry) => entry.isIntersecting)) return;
      done = true;
      observer.disconnect();
      onReach();
    }, { rootMargin: "600px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [onReach]);
  return <div ref={ref} className="h-8" />;
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-9 shrink-0 rounded-full px-4 text-sm font-medium ${
        active ? "bg-violet text-white" : "bg-[#f2f3f7] text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function BookmarkButton({ post }: { post: Post }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setSaved(isBookmarked(post.id));
    return subscribeBookmarks(() => setSaved(isBookmarked(post.id)));
  }, [post.id]);
  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={() => setSaved(toggleBookmark(post))}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
        saved ? "bg-[#f3f0ff] text-violet" : "bg-[#f2f3f7] text-ink"
      }`}
    >
      <BookmarkIcon filled={saved} />
      {saved ? "저장됨" : "저장"}
    </button>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M7 4.5h10a1 1 0 0 1 1 1V19l-6-3.2L6 19V5.5a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 19.4 4.8 12.5a4.2 4.2 0 0 1 6-5.9L12 7.7l1.2-1.1a4.2 4.2 0 0 1 6 5.9z" strokeLinejoin="round" />
    </svg>
  );
}

function RepostIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 4h3v3" />
      <path d="M20 7A8 8 0 0 0 6.2 6.2" />
      <path d="M7 20H4v-3" />
      <path d="M4 17a8 8 0 0 0 13.8 1.8" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-violet" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16.5 20 20.5" strokeLinecap="round" />
    </svg>
  );
}

function platformLabel(platform: PostPlatform) {
  if (platform === "fanding") return "팬딩";
  if (platform === "cafe") return "카페";
  return "X";
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
      <path d="M3 6h11" />
      <path d="M18 6h3" />
      <circle cx="16" cy="6" r="2.2" fill="white" />
      <path d="M3 12h3" />
      <path d="M10 12h11" />
      <circle cx="8" cy="12" r="2.2" fill="white" />
      <path d="M3 18h9" />
      <path d="M16 18h5" />
      <circle cx="14" cy="18" r="2.2" fill="white" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.6v2.1M12 18.3v2.1M4.8 6.6l1.5 1.5M17.7 15.9l1.5 1.5M3.6 12h2.1M18.3 12h2.1M4.8 17.4l1.5-1.5M17.7 8.1l1.5-1.5" />
    </svg>
  );
}
