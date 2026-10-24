import { STATUS_LABEL } from "@/lib/parse";

const COLOR: Record<string, string> = {
  ready: "bg-amber-100 text-amber-900",
  approved: "bg-emerald-100 text-emerald-900",
  rejected: "bg-red-100 text-red-900",
  "needs-fix": "bg-orange-100 text-orange-900",
  draft: "bg-zinc-100 text-zinc-700",
  done: "bg-emerald-100 text-emerald-900",
  partial: "bg-amber-100 text-amber-900",
};

export function StatusChip({ status }: { status: string | null }) {
  if (!status) return null;
  return <span className={`chip ${COLOR[status] ?? "bg-zinc-100 text-zinc-700"}`}>{STATUS_LABEL[status] ?? status}</span>;
}
