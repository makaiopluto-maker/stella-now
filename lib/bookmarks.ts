"use client";

import type { Post } from "@/content/posts";
import { readJson, subscribePref, writeJson } from "@/lib/prefs";

const key = "stella-now-bookmarks";

export function readBookmarks() {
  return readJson<Post[]>(key, []);
}

export function isBookmarked(id: string) {
  return readBookmarks().some((post) => post.id === id);
}

export function toggleBookmark(post: Post) {
  const current = readBookmarks();
  const exists = current.some((item) => item.id === post.id);
  const next = exists ? current.filter((item) => item.id !== post.id) : [post, ...current.filter((item) => item.id !== post.id)];
  writeJson(key, next.slice(0, 500));
  return !exists;
}

export function subscribeBookmarks(listener: () => void) {
  return subscribePref(key, listener);
}
