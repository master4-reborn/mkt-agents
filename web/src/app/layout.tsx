import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { isAuthed } from "@/lib/auth";
import { currentFiles } from "@/lib/sync";
import { weekLabel } from "@/lib/office";
import { weekNo } from "@/lib/parse";

export const metadata: Metadata = {
  title: "Đội AI",
  description: "Đội nhân viên AI marketing của bạn",
};
export const viewport: Viewport = { themeColor: "#fff7fa", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAuthed();
  const waiting = authed ? (await currentFiles("draft").catch(() => [])).filter((d) => d.status === "ready").length : 0;
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- app router root layout: one page, loaded once */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap" />
      </head>
      <body className="min-h-screen antialiased">
        <Nav waiting={waiting} footer={`Tuần ${weekNo(weekLabel())}\nĐội AI của bạn`} />
        <main className="mx-auto max-w-3xl px-4 pb-[110px] pt-4 lg:max-w-none lg:px-8 lg:pb-10 lg:pl-[252px] lg:pt-7">{children}</main>
      </body>
    </html>
  );
}
