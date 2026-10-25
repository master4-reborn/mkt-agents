import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBrand } from "@/lib/brands";
import { fileByName } from "@/lib/sync";
import { parseFile, weekNo } from "@/lib/parse";
import { Markdown } from "@/components/Markdown";
import { IconBack } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function Report({ params }: { params: Promise<{ name: string }> }) {
  const { id: sid } = await requireBrand();
  const { name } = await params;
  const f = await fileByName(sid, decodeURIComponent(name));
  if (!f || f.kind !== "report") notFound();
  const p = parseFile(f.name, f.content);
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-2.5">
        <Link href="/reports" aria-label="Quay lại" className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-card text-ink"><IconBack /></Link>
        <h1 className="text-lg font-bold">Báo cáo tuần {weekNo(f.week)}</h1>
      </div>
      <div className="card"><Markdown>{p.body.replace(/^#\s+.*\n/, "")}</Markdown></div>
    </div>
  );
}
