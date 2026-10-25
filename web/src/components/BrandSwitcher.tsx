"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { switchBrand } from "@/app/actions";
import { IconCheck, IconChevron, IconPlus } from "./Icons";
import { SubmitButton } from "./SubmitButton";

type B = { id: string; name: string; waiting: number; running: boolean };

// Which brand the whole app is about. One tap opens the list; picking one switches every page to its office.
// Hidden on the pages that have their own top bar (a post, a report) so they keep their room.
export function BrandSwitcher({ brands, current }: { brands: B[]; current: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (/^\/(drafts|reports)\/.+/.test(pathname) || pathname === "/brand/new") return null;
  const me = brands.find((b) => b.id === current) ?? brands[0];
  const elsewhere = brands.filter((b) => b.id !== current).reduce((n, b) => n + b.waiting, 0);
  return (
    <div className="relative mb-3.5">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="listbox" className="flex h-10 w-full items-center gap-2.5 rounded-[14px] border border-line bg-card pl-2 pr-3 text-left lg:w-auto lg:min-w-[260px]">
        <Initial name={me.name} />
        <span className="min-w-0 flex-1 truncate text-sm font-bold">{me.name}</span>
        {elsewhere > 0 && <span className="flex-none rounded-full bg-accent px-1.5 text-[11px] font-bold text-white" title="Bài chờ duyệt ở thương hiệu khác">{elsewhere}</span>}
        <IconChevron size={16} className={`flex-none text-muted transition-transform ${open ? "-rotate-90" : "rotate-90"}`} />
      </button>
      {open && (
        <>
          <button type="button" aria-label="Đóng" onClick={() => setOpen(false)} className="fixed inset-0 z-30 cursor-default bg-ink/20" />
          <div role="listbox" aria-label="Thương hiệu" className="absolute left-0 right-0 top-[46px] z-40 overflow-hidden rounded-[18px] border border-line bg-card shadow-[0_12px_40px_rgba(43,26,34,0.18)] lg:right-auto lg:w-[320px]">
            {brands.map((b) => {
              const on = b.id === current;
              const sub = b.running ? "đội đang làm việc" : b.waiting > 0 ? `${b.waiting} bài chờ bạn duyệt` : "đang rảnh";
              const inner = (
                <>
                  <Initial name={b.name} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">{b.name}</span>
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${b.running ? "bg-[#e0a000] pulse" : b.waiting > 0 ? "bg-accent" : "bg-ok"}`} />
                      {sub}
                    </span>
                  </span>
                  {on && <IconCheck size={16} className="flex-none text-accent" />}
                </>
              );
              return on ? (
                <div key={b.id} role="option" aria-selected className="flex items-center gap-2.5 border-b border-line-soft bg-accent-soft/40 px-3 py-2.5">{inner}</div>
              ) : (
                <form key={b.id} action={switchBrand} className="contents">
                  <input type="hidden" name="id" value={b.id} />
                  <SubmitButton className="flex w-full items-center gap-2.5 border-b border-line-soft px-3 py-2.5 text-left text-ink hover:bg-bg" pendingLabel="Đang chuyển…" spinnerSize={16}>{inner}</SubmitButton>
                </form>
              );
            })}
            <Link href="/brand/new" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-3 py-3 text-sm font-semibold text-accent-deep">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] border border-dashed border-accent"><IconPlus size={16} /></span>
              Thêm thương hiệu
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

const Initial = ({ name }: { name: string }) => (
  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-[9px] bg-ink text-[13px] font-bold text-white">{name.trim().charAt(0).toUpperCase()}</span>
);
