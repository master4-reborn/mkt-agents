import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireBrand } from "@/lib/brands";
import { md } from "@/lib/parse";
import { EMPLOYEES, EMPLOYEE_LABEL, reviewDoc, scopeLabel, skillDoc, versionWithSkill, SHARED, type VersionRow } from "@/lib/skills";
import { getDb, scoutRuns } from "@/lib/db";
import { SubmitButton } from "@/components/SubmitButton";
import { IconBack, IconExternal } from "@/components/Icons";
import { approveSkill, rejectSkill, restoreSkill, toggleSkill } from "../../../actions";

export const dynamic = "force-dynamic";

const day = (d: Date) => d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

const STATUS: Record<string, [string, string]> = {
  proposed: ["Chờ duyệt", "chip-accent"],
  current: ["Đang dùng", "chip-ok"],
  superseded: ["Bản cũ", "chip-outline"],
  rejected: ["Đã bỏ", "chip-outline"],
};

// One version of a skill: a proposal to approve, edit or turn down, or a version in use with its history. The boss reads
// every rule with its sources here before anything reaches the team.
export default async function SkillVersion({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireBrand();
  const row = await versionWithSkill(Number((await params).id));
  if (!row || (row.s.scope !== SHARED && row.s.scope !== me.id)) notFound();
  const { v, s, history } = row;
  const doc = skillDoc(v.content);
  const rv = reviewDoc(v.review);
  const db = await getDb();
  const [run] = v.run ? await db.select().from(scoutRuns).where(eq(scoutRuns.id, v.run)) : [];
  const scope = await scopeLabel(s.scope);
  const proposed = v.status === "proposed";
  const retired = s.status === "retired";
  const receivers = s.receivers.split(",");
  const [label, chip] = retired && v.status === "current" ? ["Ngừng dùng", "chip-outline"] : STATUS[v.status] ?? [v.status, "chip-outline"];
  const moved = proposed && rv.kind === "update" && (v.base ?? 0) !== (s.current ?? 0);
  const back = s.scope === SHARED ? "/brand#ky-nang-chung" : "/brand#ky-nang-rieng";

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-2.5">
        <Link href={back} aria-label="Quay lại kỹ năng" className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-line bg-card text-ink"><IconBack /></Link>
        <div className="min-w-0 flex-1 truncate text-sm font-semibold">{v.version ? `Bản ${v.version}` : "Đề xuất"}{v.status === "current" && v.decidedAt ? ` · từ ${day(v.decidedAt)}` : ""}</div>
        <span className={`chip ${chip}`}>{label}</span>
      </div>

      <section className="flex flex-col gap-2">
        <h1 className="text-[22px] font-bold leading-tight">{doc.title || s.title}</h1>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="chip bg-ink text-white">{scope}</span>
          <span className="chip chip-accent">{proposed ? (s.current ? `Cập nhật · bản ${s.current + 1}` : "Mới") : v.reason?.startsWith("Dùng lại") ? v.reason : `Bản ${v.version ?? "?"}`}</span>
          {!proposed && receivers.map((r) => <span key={r} className="chip chip-outline">{EMPLOYEE_LABEL[r] ?? r}</span>)}
          {v.edited && <span className="chip chip-warn">Bạn đã sửa</span>}
        </div>
        {doc.when && <p className="text-[13px] leading-relaxed text-muted">{md(doc.when)}</p>}
      </section>

      {rv.why && (
        <section className="card flex flex-col gap-1.5">
          <div className="eyebrow">Vì sao bây giờ</div>
          <p className="whitespace-pre-line text-sm leading-relaxed">{md(rv.why)}</p>
          {run?.costCents != null && <div className="text-xs text-muted">Lần tìm này tốn {(run.costCents / 100).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} USD.</div>}
        </section>
      )}

      {run?.verdict && (run.verdict === "satisfied"
        ? <div className="rounded-2xl bg-ok-soft px-4 py-3 text-[13px] text-ok-deep">Bộ chấm độc lập cho qua: đủ nguồn, quy tắc chấm được đúng sai, không trái nội quy.</div>
        : <div className="rounded-2xl bg-warn-soft px-4 py-3 text-[13px] text-warn">Bộ chấm độc lập chưa cho qua hết sau 3 vòng. Xem Cảnh báo và số nguồn của từng quy tắc; quy tắc chỉ có 1 nguồn được tô vàng. Sửa quy tắc rồi duyệt, hoặc bỏ kèm lý do.</div>)}

      {moved && <div className="rounded-2xl bg-warn-soft px-4 py-3 text-[13px] text-warn">Kỹ năng đã sang bản {s.current} từ khi trinh sát viết đề xuất này (dựa trên bản {v.base}). Đọc kỹ phần thay đổi, hoặc bỏ đề xuất và tìm lại.</div>}

      {rv.warnings.length > 0 && (
        <section className="flex flex-col gap-1.5 rounded-2xl border border-bad bg-bad-soft px-4 py-3">
          <div className="text-[13px] font-bold text-bad">Cảnh báo</div>
          {rv.warnings.map((w, i) => <div key={i} className="text-[13px] leading-relaxed text-bad">{md(w)}</div>)}
        </section>
      )}

      {rv.changes.length > 0 && (
        <List title={`Thay đổi so với bản ${v.base ?? s.current}`} items={rv.changes} />
      )}

      <section className="overflow-hidden rounded-[18px] border border-line bg-card">
        <div className="px-4 pb-1.5 pt-3 text-xs font-bold uppercase tracking-wider text-muted">Quy tắc · {doc.rules.length}</div>
        {doc.rules.map((r, i) => (
          <div key={i} className="row items-start">
            <span className="w-5 flex-none text-sm font-bold text-accent-deep">{i + 1}</span>
            <span className="min-w-0 flex-1 text-sm leading-relaxed">{md(r.text)}</span>
            {r.sources.length > 0 && <span className={`chip flex-none ${r.sources.length === 1 ? "chip-warn" : "chip-outline"}`}>{r.sources.length} nguồn</span>}
          </div>
        ))}
      </section>

      {doc.steps.length > 0 && <List title="Các bước" items={doc.steps} numbered />}
      {doc.qa.length > 0 && <List title="QA kiểm thế nào" items={doc.qa} />}
      {doc.good.length > 0 && <List title="Ví dụ tốt" items={doc.good} />}
      {doc.bad.length > 0 && <List title="Ví dụ dở" items={doc.bad} />}

      {doc.sources.length > 0 && (
        <section className="overflow-hidden rounded-[18px] border border-line bg-card">
          <div className="px-4 pb-1.5 pt-3 text-xs font-bold uppercase tracking-wider text-muted">Nguồn · {doc.sources.length}</div>
          {doc.sources.map((src, i) => {
            const inner = (
              <>
                <span className="w-5 flex-none text-sm font-bold text-muted">{i + 1}</span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-semibold">{md(src.site)}</span>
                  <span className="text-xs text-muted">{[src.kind, src.date && `đọc ngày ${src.date}`].filter(Boolean).join(" · ")}</span>
                </span>
                {src.url && <IconExternal className="flex-none text-faint" />}
              </>
            );
            return src.url ? <a key={i} href={src.url} target="_blank" rel="noopener noreferrer" className="row items-start text-ink">{inner}</a> : <div key={i} className="row items-start">{inner}</div>;
          })}
        </section>
      )}

      {proposed && (
        <section className="card flex flex-col gap-3">
          <form action={approveSkill} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={v.id} />
            <div className="flex flex-col gap-1.5">
              <div className="text-[13px] font-semibold">Ai dùng kỹ năng này</div>
              <div className="flex flex-wrap gap-2">
                {EMPLOYEES.map((e) => (
                  <label key={e} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" name="receiver" value={e} defaultChecked={(rv.receivers.length ? rv.receivers : receivers).includes(e)} className="h-4 w-4 accent-[#cf3d7a]" />
                    {EMPLOYEE_LABEL[e]}
                  </label>
                ))}
              </div>
            </div>
            <SubmitButton className="btn btn-accent" pendingLabel="Đang duyệt…">Duyệt, cho đội dùng</SubmitButton>
          </form>
          <details>
            <summary className="cursor-pointer text-[13px] font-semibold text-accent-deep">Sửa quy tắc rồi duyệt</summary>
            <form action={approveSkill} className="mt-2 flex flex-col gap-2">
              <input type="hidden" name="id" value={v.id} />
              {(rv.receivers.length ? rv.receivers : receivers).map((r) => <input key={r} type="hidden" name="receiver" value={r} />)}
              <div className="text-xs text-muted">Mỗi dòng một quy tắc. Đội nhận đúng chữ bạn để lại.</div>
              <textarea name="rules" className="input min-h-[220px] text-sm leading-relaxed" defaultValue={doc.rules.map((r) => r.text + (r.sources.length ? ` [nguồn: ${r.sources.join(", ")}]` : "")).join("\n")} />
              <SubmitButton className="btn btn-sm btn-dark" pendingLabel="Đang lưu…">Lưu và duyệt</SubmitButton>
            </form>
          </details>
          <details>
            <summary className="cursor-pointer text-[13px] font-semibold text-muted">Bỏ đề xuất này</summary>
            <form action={rejectSkill} className="mt-2 flex flex-col gap-2">
              <input type="hidden" name="id" value={v.id} />
              <input name="reason" className="input" placeholder="Vì sao bỏ? Lần tìm sau trinh sát sẽ đọc" required maxLength={300} autoComplete="off" />
              <SubmitButton className="btn btn-sm btn-ghost" pendingLabel="Đang bỏ…">Bỏ</SubmitButton>
            </form>
          </details>
        </section>
      )}

      {v.status === "current" && (
        <form action={toggleSkill}>
          <input type="hidden" name="id" value={v.id} />
          <input type="hidden" name="on" value={retired ? "1" : "0"} />
          <SubmitButton className={`btn btn-sm w-full ${retired ? "btn-dark" : "btn-ghost"}`} pendingLabel="Đang lưu…">{retired ? "Dùng lại kỹ năng này" : "Ngừng dùng"}</SubmitButton>
          <div className="mt-1.5 text-xs text-muted">{retired ? "Đội không còn thấy kỹ năng này. Dùng lại thì đội thấy từ việc kế tiếp." : "Đội không dùng nữa từ việc kế tiếp; lịch sử vẫn giữ."}</div>
        </form>
      )}
      {v.status === "superseded" && (
        <form action={restoreSkill}>
          <input type="hidden" name="id" value={v.id} />
          <SubmitButton className="btn btn-sm btn-dark w-full" pendingLabel="Đang lưu…">Dùng lại bản này</SubmitButton>
          <div className="mt-1.5 text-xs text-muted">Lưu thành bản mới nhất, bản đang dùng thành bản cũ.</div>
        </form>
      )}
      {v.status === "rejected" && v.reason && <div className="card text-sm"><span className="font-semibold">Đã bỏ: </span>{v.reason}</div>}

      {history.length > 1 && (
        <section className="overflow-hidden rounded-[18px] border border-line bg-card">
          <div className="px-4 pb-1.5 pt-3 text-xs font-bold uppercase tracking-wider text-muted">Lịch sử</div>
          {history.map((h) => <HistoryRow key={h.id} h={h} here={h.id === v.id} retired={retired} />)}
        </section>
      )}
    </div>
  );
}

function List({ title, items, numbered = false }: { title: string; items: string[]; numbered?: boolean }) {
  return (
    <section className="overflow-hidden rounded-[18px] border border-line bg-card">
      <div className="px-4 pb-1.5 pt-3 text-xs font-bold uppercase tracking-wider text-muted">{title}</div>
      {items.map((t, i) => (
        <div key={i} className="row items-start">
          {numbered && <span className="w-5 flex-none text-sm font-bold text-muted">{i + 1}</span>}
          <span className="min-w-0 flex-1 text-sm leading-relaxed">{md(t)}</span>
        </div>
      ))}
    </section>
  );
}

function HistoryRow({ h, here, retired }: { h: VersionRow; here: boolean; retired: boolean }) {
  const [label, chip] = retired && h.status === "current" ? ["Ngừng dùng", "chip-outline"] : STATUS[h.status] ?? [h.status, "chip-outline"];
  const inner = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-semibold">{h.version ? `Bản ${h.version}` : "Đề xuất"}{here ? " · đang xem" : ""}</span>
        <span className="truncate text-xs text-muted">{day(h.decidedAt ?? h.createdAt)}{h.reason ? ` · ${h.reason}` : ""}{h.edited ? " · bạn đã sửa" : ""}</span>
      </span>
      <span className={`chip ${chip}`}>{label}</span>
    </>
  );
  return here ? <div className="row bg-accent-soft/40">{inner}</div> : <Link href={`/brand/skill/${h.id}`} className="row text-ink">{inner}</Link>;
}
