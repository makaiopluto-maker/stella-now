import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { AppUpdateAlert } from "@/components/app-update-alert";
import { BottomNav } from "@/components/bottom-nav";
import { OshiAlert } from "@/components/oshi-alert";
import { ScheduleAlert } from "@/components/schedule-alert";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const sans = Noto_Sans_KR({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-sans-kr",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Stella Now",
  description: "스텔라이브 최신 소식",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${sans.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex h-dvh flex-col overflow-hidden bg-paper font-sans text-ink">
        <ThemeProvider>
          <SiteHeader />
          <AppUpdateAlert />
          <OshiAlert />
          <ScheduleAlert />
          <main className="mx-auto w-full max-w-md flex-1 overflow-y-auto px-5 pb-24 pt-5 md:max-w-5xl md:px-8 md:pb-16 md:pt-10">
            {children}
          </main>
          <BottomNav />
        </ThemeProvider>
      </body>
    </html>
  );
}
