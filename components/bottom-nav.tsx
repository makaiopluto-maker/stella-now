"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { hasNewNotices, subscribeNoticeBadge } from "@/lib/notice-badge";

const tabs = [
  { href: "/", label: "홈", icon: "home" },
  { href: "/members", label: "멤버", icon: "members" },
  { href: "/posts", label: "게시물", icon: "posts" },
  { href: "/calendar", label: "일정", icon: "calendar" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const fresh = useSyncExternalStore(subscribeNoticeBadge, hasNewNotices, () => false);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2">
        {tabs.map((tab) => {
          const active =
            tab.href === "/"
              ? pathname === "/"
              : tab.href === "/members"
                ? pathname.startsWith("/members")
                : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex flex-col items-center gap-1 py-1 text-[11px] ${
                active ? "text-violet" : "text-[#b0b4be]"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <span className="relative">
                <TabIcon name={tab.icon} active={active} />
                {tab.icon === "posts" && fresh && !pathname.startsWith("/posts") ? (
                  <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-violet" />
                ) : null}
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function TabIcon({ name, active }: { name: (typeof tabs)[number]["icon"]; active: boolean }) {
  const props = {
    viewBox: "0 0 24 24",
    className: "size-6",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  if (name === "home") {
    return (
      <svg {...props} fill={active ? "currentColor" : "none"} stroke={active ? "none" : "currentColor"}>
        <path d="M4 10.6 12 4l8 6.6V20a1 1 0 0 1-1 1h-5.2v-6.2H10.2V21H5a1 1 0 0 1-1-1z" />
      </svg>
    );
  }
  if (name === "members") {
    return (
      <svg {...props}>
        <circle cx="9" cy="8" r="3" />
        <path d="M16.5 11.2a2.6 2.6 0 1 0 0-5.2" />
        <path d="M3.8 19.2c.6-2.6 2.8-4.2 5.2-4.2s4.6 1.6 5.2 4.2" />
        <path d="M15.2 15.2c1.8.2 3.3 1.4 3.9 3.8" />
      </svg>
    );
  }
  if (name === "posts") {
    return (
      <svg {...props}>
        <path d="M7 3.8h7.2L19 8.6V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.8a1 1 0 0 1 1-1Z" />
        <path d="M14 4v4.6H19" />
        <path d="M9 13h6M9 16.5h6" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3.5v3M16 3.5v3M4 10h16" />
    </svg>
  );
}
