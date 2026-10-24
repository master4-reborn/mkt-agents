import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Văn phòng marketing",
  description: "Đội nhân viên AI marketing của bạn",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased">
        <Nav />
        <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
      </body>
    </html>
  );
}
