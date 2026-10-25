import Link from "next/link";
import { requireBrand } from "@/lib/brands";
import { currentFiles } from "@/lib/sync";
import { weekLabel } from "@/lib/office";
import { parseFile, splitDraft, placeholders, qaChecklist, painPoint, postLength, POST_LIMIT, weekNo, STATUS_LABEL } from "@/lib/parse";
import { CopyButton } from "@/components/CopyButton";
import { SubmitButton } from "@/components/SubmitButton";
import { TabLinks } from "@/components/TabLinks";
import { decide } from "../actions";

export const dynamic = "force-dynamic";

const TABS: { key: string; label: string; statuses: string[] }[] = [
  { key: "cho", label: "Chờ duyệt", statuses: ["ready"] },
  { key: "da", label: "Đã duyệt", statuses: ["approved", "posted"] },
  { key: "sua", label: "Đang sửa", statuses: ["needs-fix", "draft", "rejected"] },
];

export default async function Drafts({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { id: sid } = await requireBrand();
  const { tab } = await searchParams;
  const drafts = await currentFiles(sid, "draft");
  const count = (t: (typeof TABS)[number]) => drafts.filter((d) => t.statuses.includes(d.status ?? "")).length;
  const current = TABS.find((t) => t.key === tab) ?? (count(TABS[0]) === 0 && count(TABS[1]) > 0 ? TABS[1] : TABS[0]);
  const rows = drafts.filter((d) => current.statuses.includes(d.status ?? ""));
  const other = drafts.filter((d) => !TABS.some((t) => t.statuses.includes(d.status ?? "")));
  const channel = String(parseFile(drafts[0]?.name ?? "", drafts[0]?.content ?? "").data.channel ?? "threads");

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Bài viết</h1>
        <div className="text-xs text-muted">tuần {weekNo(weekLabel())} · {cap(channel)}</div>
      </div>

      <TabLinks label="Trạng thái" current={current.key} tabs={TABS.map((t) => ({ key: t.key, label: `${t.label} · ${count(t)}`, href: `/drafts?tab=${t.key}` }))} />

      {rows.length === 0 && (
        <div className="card text-sm text-muted">
          {current.key === "cho" ? "Không có bài nào chờ bạn. Chạy tuần mới ở trang Hôm nay để có thêm bài." : current.key === "da" ? "Chưa duyệt bài nào." : "Không có bài nào đang sửa."}
        </div>
      )}

      {rows.map((d, i) => <DraftCard key={d.name} d={d} index={i + 1} tabKey={current.key} />)}

      {other.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-muted">Khác</h2>
          {other.map((d, i) => <DraftCard key={d.name} d={d} index={i + 1} tabKey="khac" />)}
        </section>
      )}
    </div>
  );
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

function DraftCard({ d, index, tabKey }: { d: { name: string; title: string; status: string | null; content: string }; index: number; tabKey: string }) {
  const p = parseFile(d.name, d.content);
  const { post } = splitDraft(p.body);
  const holes = placeholders(post);
  const qa = qaChecklist(p.body);
  const pain = painPoint(p.data.pain_point);
  const limit = POST_LIMIT[String(p.data.channel ?? "threads").toLowerCase()] ?? 500;
  const len = postLength(post);
  const href = `/drafts/${encodeURIComponent(d.name)}`;
  const label = STATUS_LABEL[d.status ?? ""] ?? d.status ?? "";
  return (
    <article className="card flex flex-col gap-2.5">
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className={`chip ${d.status === "ready" ? "chip-accent" : d.status === "approved" || d.status === "posted" ? "chip-ok" : "chip-warn"}`}>{tabKey === "cho" ? `Bài ${index}` : label}</span>
        <span>{len} / {limit} ký tự</span>
        {d.status === "posted" && <span className="ml-auto font-semibold text-ok-deep">Đã đăng</span>}
      </div>
      <h2 className="text-[17px] font-bold leading-snug"><Link href={href} className="text-ink">{d.title}</Link></h2>
      <p className="clamp-3 text-sm leading-relaxed text-ink-soft">{post.replace(/\[CẦN SẾP XÁC NHẬN:?\s*([^\]]*)\]/gi, "[…]")}</p>
      <div className="flex flex-wrap items-center gap-2">
        {pain.summary && <span className="chip chip-outline max-w-full"><span className="truncate">Nỗi đau: {pain.summary}</span></span>}
        {holes.length > 0 ? (
          <span className="chip chip-warn">Còn {holes.length} chỗ trống</span>
        ) : qa ? (
          <span className={`chip ${qa.items.every((i) => i.pass) ? "chip-ok" : "chip-bad"}`}>QA {qa.items.every((i) => i.pass) ? "đạt" : "chưa đạt"} {qa.items.filter((i) => i.pass).length}/{qa.items.length}</span>
        ) : null}
      </div>
      <div className="mt-0.5 grid grid-cols-2 gap-2">
        <Link href={href} className="btn btn-sm btn-ghost">Đọc cả bài</Link>
        {d.status === "ready" ? (
          holes.length > 0 ? (
            <Link href={href} className="btn btn-sm btn-warn">Điền chỗ trống</Link>
          ) : (
            <form action={decide} className="contents">
              <input type="hidden" name="name" value={d.name} />
              <input type="hidden" name="decision" value="approved" />
              <SubmitButton className="btn btn-sm btn-ok" pendingLabel="Đang gửi…">Duyệt</SubmitButton>
            </form>
          )
        ) : d.status === "approved" || d.status === "posted" ? (
          <CopyButton text={post} className="btn btn-sm btn-soft" label="Sao chép bài" />
        ) : (
          <span className="btn btn-sm btn-ghost text-muted" aria-disabled>Đội đang sửa</span>
        )}
      </div>
    </article>
  );
}
