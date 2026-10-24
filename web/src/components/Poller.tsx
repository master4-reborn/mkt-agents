"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type S = { status: string; listCostUsd: number; budgetUsd: number | null; stopReason: string | null };

export function statusLabel(s: S): string {
  if (s.status === "running") return "Đội đang làm việc";
  if (s.stopReason === "budget_reached") return "Hết ngân sách";
  return "Đang rảnh";
}
export function costLabel(s: S): string {
  const n = (v: number, d: number) => v.toLocaleString("vi-VN", { minimumFractionDigits: d, maximumFractionDigits: d });
  return `${n(s.listCostUsd, 1)}${s.budgetUsd ? ` / ${n(s.budgetUsd, 0)}` : ""} USD`;
}

// Shows the office status and, while the team is working, refreshes the page every few seconds.
export function Poller({ title, initial, week }: { title: string; initial: S; week: string }) {
  const [s, setS] = useState<S>(initial);
  const router = useRouter();
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/status", { cache: "no-store" });
        if (!r.ok) return;
        const next: S = await r.json();
        if (!alive) return;
        const changed = next.status !== s.status || next.listCostUsd !== s.listCostUsd;
        setS(next);
        if (changed || next.status === "running") router.refresh();
      } catch {}
    };
    const id = setInterval(tick, s.status === "running" ? 8000 : 30000);
    return () => { alive = false; clearInterval(id); };
  }, [s.status, s.listCostUsd, router]);

  const dot = s.status === "running" ? "bg-[#e0a000] pulse" : s.stopReason === "budget_reached" ? "bg-bad" : "bg-ok";
  return (
    <>
      <div className="flex min-w-0 flex-col">
        <div className="text-[17px] font-bold leading-tight">{title}</div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
          {statusLabel(s)} · tuần {week}
        </div>
      </div>
      <div className="ml-auto flex-none rounded-full border border-line bg-card px-2.5 py-1.5 text-xs font-semibold text-muted">{costLabel(s)}</div>
    </>
  );
}
