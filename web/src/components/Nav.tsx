"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CatAvatar } from "./CatAvatar";
import { IconBars, IconChat, IconCube, IconFile, IconHome, IconSearch, IconStar } from "./Icons";

const TABS = [
  { href: "/", label: "Hôm nay", Icon: IconHome },
  { href: "/drafts", label: "Bài", Icon: IconFile },
  { href: "/research", label: "Nghiên cứu", Icon: IconSearch },
  { href: "/chat", label: "Trưởng nhóm", Icon: IconChat },
];
const MORE = [
  { href: "/reports", label: "Báo cáo", Icon: IconBars },
  { href: "/brand", label: "Thương hiệu", Icon: IconStar },
  { href: "/office", label: "Văn phòng 3D", Icon: IconCube },
];

function active(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

// Phone: four tabs along the bottom. Desktop: a sidebar with everything.
// The tapped tab lights up at once, before its page arrives. Hidden on the login page and under a draft's own action bar.
export function Nav({ waiting, footer }: { waiting: number; footer: string }) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [seen, setSeen] = useState(pathname);
  if (seen !== pathname) {
    setSeen(pathname);
    setPendingHref(null);
  }
  const isOn = (href: string) => (pendingHref ? href === pendingHref : active(pathname, href));
  if (pathname === "/login") return null;
  const underActionBar = /^\/drafts\/.+/.test(pathname);
  return (
    <>
      {!underActionBar && (
        <nav aria-label="Điều hướng" className="fixed inset-x-0 bottom-0 z-30 grid h-[84px] grid-cols-4 gap-1 border-t border-line bg-card px-2 pb-[22px] pt-[10px] lg:hidden" style={{ paddingBottom: "max(22px, env(safe-area-inset-bottom))" }}>
          {TABS.map(({ href, label, Icon }) => {
            const on = isOn(href);
            return (
              <Link key={href} href={href} aria-current={on ? "page" : undefined} onClick={() => setPendingHref(href)} className={`flex flex-col items-center gap-1 text-[11px] font-semibold ${on ? "text-accent" : "text-muted"}`}>
                <span className="relative">
                  <Icon />
                  {href === "/drafts" && waiting > 0 && <span className="absolute -right-2 -top-1.5 rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">{waiting}</span>}
                </span>
                {label}
              </Link>
            );
          })}
        </nav>
      )}
      <nav aria-label="Điều hướng" className="fixed inset-y-0 left-0 z-30 hidden w-[220px] flex-col gap-1.5 border-r border-line bg-card px-4 py-6 lg:flex">
        <Link href="/" className="flex items-center gap-2.5 px-2 pb-4 text-base font-bold text-ink">
          <CatAvatar size={34} /> Đội AI
        </Link>
        {[...TABS, ...MORE].map(({ href, label, Icon }) => {
          const on = isOn(href);
          return (
            <Link key={href} href={href} aria-current={on ? "page" : undefined} onClick={() => setPendingHref(href)} className={`flex h-[42px] items-center gap-2.5 rounded-xl px-3 text-sm font-semibold ${on ? "bg-accent-soft text-accent-deep" : "text-ink-soft hover:bg-bg"}`}>
              <Icon size={18} /> {label}
              {href === "/drafts" && waiting > 0 && <span className="ml-auto rounded-full bg-accent px-2 text-xs text-white">{waiting}</span>}
            </Link>
          );
        })}
        <div className="mt-auto rounded-xl border border-line bg-bg px-3 py-2.5 text-xs leading-relaxed text-muted whitespace-pre-line">{footer}</div>
      </nav>
    </>
  );
}
