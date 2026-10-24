import Link from "next/link";
import { StatusChip } from "./StatusChip";

type Row = { name: string; title: string | null; status: string | null; week: string | null; createdAt: Date };

export function FileList({ rows, base, empty }: { rows: Row[]; base: string; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-zinc-500">{empty}</p>;
  return (
    <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
      {rows.map((f) => (
        <li key={f.name}>
          <Link href={`${base}/${encodeURIComponent(f.name)}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50">
            <div className="min-w-0">
              <div className="truncate font-medium">{f.title ?? f.name}</div>
              <div className="text-xs text-zinc-500">{f.week ?? ""} · {f.name}</div>
            </div>
            <StatusChip status={f.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
