import type { Post } from "@/content/posts";

type TweetArchive = {
  posts: Post[];
  cursors: Record<string, string | null>;
};

const empty: TweetArchive = { posts: [], cursors: {} };
let memory: TweetArchive = empty;
let ready = false;
let writing = false;
let pendingPosts: Post[] = [];
let cursorsDirty = false;
let hooked = false;

export function cachedTweets() {
  return ready ? memory : null;
}

export async function readTweetArchive() {
  hook();
  if (ready) return memory;
  try {
    const saved = await read();
    memory = {
      posts: mergePosts(saved.posts, memory.posts),
      cursors: { ...saved.cursors, ...memory.cursors },
    };
  } catch {
    // Keep whatever is already in memory. A storage failure must not drop the list.
  }
  ready = true;
  return memory;
}

export function rememberTweets(incoming: Post[], cursors: Record<string, string | null>) {
  hook();
  if (incoming.length > 0) pendingPosts.push(...incoming);
  if (Object.keys(cursors).length > 0) cursorsDirty = true;
  memory = {
    posts: mergePosts(memory.posts, incoming),
    cursors: { ...memory.cursors, ...cursors },
  };
  ready = true;
  if (!writing) persist();
}

export function flushTweetArchive() {
  persist();
}

function hook() {
  if (hooked || typeof window === "undefined") return;
  hooked = true;
  window.addEventListener("pagehide", () => persist());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") persist();
  });
}

function persist() {
  if (writing || (!pendingPosts.length && !cursorsDirty)) return;
  writing = true;
  const posts = pendingPosts;
  const cursors = memory.cursors;
  pendingPosts = [];
  cursorsDirty = false;
  void write(posts, cursors)
    .catch(() => {
      pendingPosts = posts.concat(pendingPosts);
      cursorsDirty = true;
    })
    .finally(() => {
      writing = false;
      if (pendingPosts.length > 0 || cursorsDirty) persist();
    });
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("stella-now", 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("posts")) db.createObjectStore("posts", { keyPath: "id" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      if (!db.objectStoreNames.contains("archive") || !request.transaction) return;
      const tx = request.transaction;
      const saved = tx.objectStore("archive").get("tweets");
      saved.onsuccess = () => {
        const archive = saved.result as TweetArchive | undefined;
        if (!archive) return;
        const posts = tx.objectStore("posts");
        for (const post of archive.posts ?? []) posts.put(post);
        if (archive.cursors) tx.objectStore("meta").put(archive.cursors, "cursors");
      };
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function read() {
  const db = await openDb();
  try {
    return await new Promise<TweetArchive>((resolve, reject) => {
      const tx = db.transaction(["posts", "meta"], "readonly");
      const postsRequest = tx.objectStore("posts").getAll();
      const cursorRequest = tx.objectStore("meta").get("cursors");
      tx.oncomplete = () => {
        const posts = Array.isArray(postsRequest.result) ? (postsRequest.result as Post[]) : [];
        const cursors = cursorRequest.result && typeof cursorRequest.result === "object" ? (cursorRequest.result as Record<string, string | null>) : {};
        resolve({ posts, cursors });
      };
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function write(posts: Post[], cursors: Record<string, string | null>) {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["posts", "meta"], "readwrite");
      const store = tx.objectStore("posts");
      for (const post of posts) store.put(post);
      tx.objectStore("meta").put(cursors, "cursors");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function mergePosts(saved: Post[], incoming: Post[]) {
  const map = new Map(saved.map((post) => [post.id, post]));
  for (const post of incoming) map.set(post.id, { ...map.get(post.id), ...post });
  return [...map.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
