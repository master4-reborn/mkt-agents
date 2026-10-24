import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { sync, fileByName } from "@/lib/sync";
import { parseFile, splitDraft } from "@/lib/parse";
import { Markdown } from "@/components/Markdown";
import { StatusChip } from "@/components/StatusChip";
import { decide } from "../../actions";

export const dynamic = "force-dynamic";

export default async function Draft({ params }: { params: Promise<{ name: string }> }) {
  await requireAuth();
  const { name } = await params;
  await sync().catch(() => {});
  const f = await fileByName(decodeURIComponent(name));
  if (!f) notFound();
  const p = parseFile(f.name, f.content);
  const { post, rest } = splitDraft(p.body);
  const chars = post.replace(/\n/g, "").length;
  const canDecide = f.status === "ready";

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={f.status} />
          <span className="text-xs text-zinc-500">{f.week} · {String(p.data.channel ?? "")} · {chars} ký tự</span>
        </div>
        <h1 className="mt-1 text-xl font-semibold">{f.title}</h1>
        {p.data.product ? <p className="text-sm text-zinc-600">{String(p.data.product)}</p> : null}
      </div>

      <div className="card whitespace-pre-wrap text-[15px] leading-relaxed">{post}</div>

      {f.decision && (
        <p className="text-sm text-zinc-600">
          Bạn đã {f.decision.decision === "approved" ? "duyệt" : "trả lại"} lúc {f.decision.createdAt.toLocaleString("vi-VN")}
          {f.decision.note ? `: ${f.decision.note}` : ""}.
        </p>
      )}

      {canDecide && (
        <div className="card space-y-3">
          <form action={decide} className="flex gap-2">
            <input type="hidden" name="name" value={f.name} />
            <input type="hidden" name="decision" value="approved" />
            <button className="btn-good flex-1">Duyệt bài này</button>
          </form>
          <form action={decide} className="space-y-2">
            <input type="hidden" name="name" value={f.name} />
            <input type="hidden" name="decision" value="rejected" />
            <input name="note" className="input" placeholder="Ghi chú cho người viết (vì sao trả lại)" required />
            <button className="btn-warn w-full">Trả lại để sửa</button>
          </form>
        </div>
      )}

      <details className="card">
        <summary className="cursor-pointer text-sm font-medium">Nguồn, ghi chú và QA</summary>
        <Markdown className="mt-2 text-sm">{rest}</Markdown>
      </details>
    </div>
  );
}
