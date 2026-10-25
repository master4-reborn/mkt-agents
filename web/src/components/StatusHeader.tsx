import type { OfficeStatus } from "@/lib/office";

export type S = OfficeStatus & { stopReason: string | null };

export function statusLabel(s: S): string {
  if (s.status === "running") return "Đội đang làm việc";
  if (s.stopReason === "budget_reached") return "Hết ngân sách";
  return "Đang rảnh";
}
export function costLabel(s: S): string {
  const n = (v: number, d: number) => v.toLocaleString("vi-VN", { minimumFractionDigits: d, maximumFractionDigits: d });
  return `${n(s.listCostUsd, 1)}${s.budgetUsd ? ` / ${n(s.budgetUsd, 0)}` : ""} USD`;
}

// Page title with the office status under it and the running cost on the right. Refreshed by LiveSync.
export function StatusHeader({ title, s, week }: { title: string; s: S; week: string }) {
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
