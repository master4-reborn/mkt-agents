import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { sync, fileByName } from "@/lib/sync";
import { parseFile } from "@/lib/parse";
import { Markdown } from "@/components/Markdown";
import { StatusChip } from "@/components/StatusChip";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  await requireAuth();
  const { name } = await params;
  await sync().catch(() => {});
  const f = await fileByName(decodeURIComponent(name));
  if (!f) notFound();
  const p = parseFile(f.name, f.content);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><StatusChip status={f.status} /><span className="text-xs text-zinc-500">{f.name}</span></div>
      <h1 className="text-xl font-semibold">{f.title}</h1>
      <div className="card"><Markdown className="text-sm">{p.body}</Markdown></div>
    </div>
  );
}
