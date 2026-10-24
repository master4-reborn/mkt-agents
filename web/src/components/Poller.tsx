"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type S = { status: string; listCostUsd: number; budgetUsd: number | null; stopReason: string | null };

// Shows the office status and, while the team is working, refreshes the page every few seconds.
export function Poller({ initial }: { initial: S }) {
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

  const label =
    s.status === "running" ? "Đội đang làm việc" :
    s.stopReason === "budget_reached" ? "Hết ngân sách, cần nâng" :
    s.stopReason === "requires_action" ? "Đang chờ bạn" :
    s.status === "idle" ? "Rảnh" : s.status;
  const dot = s.status === "running" ? "bg-amber-500 animate-pulse" : s.stopReason === "budget_reached" ? "bg-red-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-600">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} />
      <span>{label}</span>
      <span className="text-zinc-400">·</span>
      <span>{s.listCostUsd.toFixed(2)} USD{s.budgetUsd ? ` / ${s.budgetUsd.toFixed(0)} USD` : ""}</span>
    </div>
  );
}
