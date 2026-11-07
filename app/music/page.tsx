import type { Metadata } from "next";
import { MusicList } from "@/components/music-list";
import { tracks } from "@/content/tracks";

export const metadata: Metadata = { title: "음원 · Stella Now" };

export default function MusicPage() {
  return <MusicList tracks={tracks} />;
}
