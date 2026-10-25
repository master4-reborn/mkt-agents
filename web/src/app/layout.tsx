import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { LiveSync } from "@/components/LiveSync";
import { BrandSwitcher } from "@/components/BrandSwitcher";
import { isAuthed } from "@/lib/auth";
import { ensureSynced } from "@/lib/sync";
import { knownStatus, weekLabel, type OfficeStatus } from "@/lib/office";
import { brandSummaries, currentBrand, ensureBrands, type BrandSummary } from "@/lib/brands";
import { weekNo } from "@/lib/parse";

export const metadata: Metadata = {
  title: "Đội AI",
  description: "Đội nhân viên AI marketing của bạn",
};
export const viewport: Viewport = { themeColor: "#fff7fa", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAuthed();
  let brandId: string | null = null;
  let summaries: BrandSummary[] = [];
  let status: OfficeStatus | null = null;
  if (authed) {
    await ensureBrands().catch(() => {});
    const brand = await currentBrand().catch(() => null);
    if (brand) {
      brandId = brand.id;
      await ensureSynced(brand.id).catch(() => {});
      [summaries, status] = await Promise.all([brandSummaries().catch(() => []), knownStatus(brand.id).catch(() => null)]);
    }
  }
  const waiting = summaries.find((s) => s.id === brandId)?.waiting ?? 0;
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- app router root layout: one page, loaded once */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap" />
      </head>
      <body className="min-h-screen antialiased">
        {brandId && status && <LiveSync key={brandId} initial={{ status: status.status, listCostUsd: status.listCostUsd }} />}
        <Nav waiting={waiting} footer={`Tuần ${weekNo(weekLabel())}\nĐội AI của bạn`} />
        <main className="mx-auto max-w-3xl px-4 pb-[110px] pt-4 lg:max-w-none lg:px-8 lg:pb-10 lg:pl-[252px] lg:pt-7">
          {brandId && <BrandSwitcher brands={summaries} current={brandId} />}
          {children}
        </main>
      </body>
    </html>
  );
}
