"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "홈" },
  { href: "/members", label: "멤버" },
  { href: "/posts", label: "게시물" },
  { href: "/calendar", label: "일정" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="z-20 hidden shrink-0 border-b border-line bg-nav md:block">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-8 px-8">
        <Link href="/" className="text-[26px] font-bold leading-none tracking-tight whitespace-nowrap">
          StellaNow
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  active ? "bg-soft-strong text-violet" : "text-muted"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/settings"
          aria-label="설정"
          aria-current={pathname.startsWith("/settings") ? "page" : undefined}
          className={`ml-auto grid size-10 place-items-center ${
            pathname.startsWith("/settings") ? "text-violet" : "text-ink"
          }`}
        >
          <GearIcon />
        </Link>
      </div>
    </header>
  );
}

function GearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.6v2.1M12 18.3v2.1M4.8 6.6l1.5 1.5M17.7 15.9l1.5 1.5M3.6 12h2.1M18.3 12h2.1M4.8 17.4l1.5-1.5M17.7 8.1l1.5-1.5" />
    </svg>
  );
}
