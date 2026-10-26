"use client";

import { useState } from "react";
import { Dim, SubmitButton } from "@/components/SubmitButton";
import { IconCheck } from "@/components/Icons";
import { approveSkill, rejectSkill } from "../../../actions";

export type Chip = { label: string; cls: string } | null;
export type Merge = {
  id: number;
  title: string;
  version: number;
  next: number;
  href: string;
  posts: number;
  receivers: string[];
  added: { text: string; chip: Chip }[];
  dropped: { j: number; text: string }[];
  same: string[];
  rules: string;
};

const REASONS = ["Không hợp quán nhỏ", "Nguồn chưa đủ tin", "Chưa cần lúc này"];

// A proposal's decision: who receives it, then Bỏ / Sửa / Duyệt in a bar pinned to the bottom of the phone screen (in the
// page flow on desktop), like the post review. A proposal that looks like a skill in use first asks whether it becomes
// that skill's next version, with the two rule lists compared; the full proposal is folded below.
export function Review({ id, receivers, employees, rules, merge, summary, children }: {
  id: number;
  receivers: string[];
  employees: [string, string][];
  rules: string;
  merge: Merge | null;
  summary: string;
  children: React.ReactNode;
}) {
  const [into, setInto] = useState(!!merge);
  const [who, setWho] = useState(merge ? merge.receivers : receivers);
  const [keep, setKeep] = useState(merge ? merge.dropped.map((d) => d.j) : []);
  const [sheet, setSheet] = useState<"" | "edit" | "reject">("");
  const [reason, setReason] = useState("");
  const pick = (m: boolean) => {
    setInto(m);
    setWho(m && merge ? merge.receivers : receivers);
  };
  const flip = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
  const label = (e: string) => employees.find(([k]) => k === e)?.[1] ?? e;
  const approve = merge ? (into ? `Duyệt thành bản ${merge.next}` : "Duyệt, thêm kỹ năng") : "Duyệt, cho đội dùng";

  return (
    <>
      {merge && (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[15px] font-bold">Bạn muốn</legend>
            <Option on={into} onPick={() => pick(true)} title={`Làm bản ${merge.next} của ${merge.title}`} tag="Nên chọn">
              Thay bản {merge.version}. Bản {merge.version} vẫn nằm trong lịch sử, dùng lại được.
            </Option>
            <Option on={!into} onPick={() => pick(false)} title="Giữ thành kỹ năng riêng">
              Đội nhận cả hai. Chỉ nên chọn khi hai cái dùng cho việc khác nhau.
            </Option>
          </fieldset>

          <section className="overflow-hidden rounded-[18px] border border-line bg-card">
            <div className="px-4 pb-1.5 pt-3 text-xs font-bold uppercase tracking-wider text-muted">So với bản {merge.version}</div>
            {merge.added.length > 0 && (
              <div className="flex flex-col border-t border-line-soft pb-2">
                <div className="px-4 pb-1 pt-2.5 text-xs font-bold text-ok-deep">Mới trong đề xuất · {merge.added.length}</div>
                {merge.added.map((r, i) => (
                  <div key={i} className="flex items-start gap-2.5 px-4 py-1.5">
                    <span aria-hidden className="w-4 flex-none text-[15px] font-bold leading-snug text-ok-deep">+</span>
                    <span className="min-w-0 flex-1 text-sm leading-relaxed"><span className="sr-only">Thêm: </span>{r.text}</span>
                    {r.chip && <span className={`chip flex-none ${r.chip.cls}`}>{r.chip.label}</span>}
                  </div>
                ))}
              </div>
            )}
            {merge.dropped.length > 0 && (
              <div className="flex flex-col border-t border-line-soft pb-2">
                <div className="px-4 pb-1 pt-2.5 text-xs font-bold text-bad">Bản {merge.version} có, đề xuất không có · {merge.dropped.length}</div>
                {merge.dropped.map((d) => (
                  <div key={d.j} className="flex flex-col gap-1 px-4 py-1.5">
                    <div className="flex items-start gap-2.5">
                      <span aria-hidden className="w-4 flex-none text-[15px] font-bold leading-snug text-bad">−</span>
                      <span className="min-w-0 flex-1 text-sm leading-relaxed"><span className="sr-only">Chỉ bản cũ có: </span>{d.text}</span>
                    </div>
                    {into && (
                      <label className="ml-[26px] flex min-h-9 cursor-pointer items-center gap-2 text-[13px] font-semibold text-ink-soft">
                        <input type="checkbox" checked={keep.includes(d.j)} onChange={() => setKeep((k) => flip(k, d.j))} className="h-[18px] w-[18px] accent-[#cf3d7a]" />
                        Giữ trong bản {merge.next}
                      </label>
                    )}
                  </div>
                ))}
              </div>
            )}
            {merge.same.length > 0 && (
              <details className="group border-t border-line-soft">
                <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-semibold text-muted [&::-webkit-details-marker]:hidden">Giống nhau · {merge.same.length} quy tắc</summary>
                {merge.same.map((t, i) => <div key={i} className="px-4 pb-2.5 text-sm leading-relaxed text-ink-soft">{t}</div>)}
              </details>
            )}
          </section>

          <details className="group overflow-hidden rounded-[18px] border border-line bg-card">
            <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">Toàn bộ đề xuất · {summary}</summary>
            <div className="flex flex-col gap-3.5 border-t border-line-soft bg-bg p-3">{children}</div>
          </details>
        </>
      )}
      {!merge && children}

      <div className="h-24 lg:hidden" aria-hidden />
      <form
        action={sheet === "reject" ? rejectSkill : approveSkill}
        className="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-2.5 border-t border-line bg-card px-4 pt-3 shadow-[0_-6px_20px_rgba(43,26,34,0.06)] lg:static lg:rounded-[18px] lg:border lg:p-4 lg:shadow-none"
        style={{ paddingBottom: "max(26px, env(safe-area-inset-bottom))" }}
      >
        <input type="hidden" name="id" value={id} />
        {sheet !== "reject" && (
          <>
            {into && merge && <input type="hidden" name="into" value={merge.id} />}
            {into && keep.map((j) => <input key={j} type="hidden" name="keep" value={j} />)}
            {who.map((e) => <input key={e} type="hidden" name="receiver" value={e} />)}
          </>
        )}

        {sheet === "reject" && (
          <div className="flex flex-col gap-2">
            <div className="text-[15px] font-bold">Vì sao bỏ?</div>
            <div className="text-xs text-muted">Lần tìm sau trinh sát đọc lý do này.</div>
            <div className="flex flex-wrap gap-1.5">
              {[...(merge ? ["Trùng kỹ năng đang dùng"] : []), ...REASONS].map((r) => (
                <button key={r} type="button" onClick={() => setReason(r)} aria-pressed={reason === r} className={`chip h-9 cursor-pointer px-3 ${reason === r ? "chip-accent" : "chip-outline text-ink"}`}>{r}</button>
              ))}
            </div>
            <input name="reason" value={reason} onChange={(e) => setReason(e.target.value)} className="input" placeholder="Hoặc tự viết lý do" required maxLength={300} autoComplete="off" aria-label="Lý do bỏ" />
          </div>
        )}

        {sheet === "edit" && (
          <div className="flex flex-col gap-1.5">
            <div className="text-[15px] font-bold">Sửa quy tắc rồi duyệt</div>
            <div className="text-xs text-muted">Mỗi dòng một quy tắc. Đội nhận đúng chữ bạn để lại.</div>
            <textarea key={String(into)} name="rules" aria-label="Quy tắc" className="input h-[40vh] text-sm leading-relaxed" defaultValue={into && merge ? merge.rules : rules} />
          </div>
        )}

        {sheet === "" && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 text-xs font-semibold text-muted">Ai dùng</span>
            {employees.map(([e]) => {
              const on = who.includes(e);
              return (
                <button key={e} type="button" aria-pressed={on} onClick={() => setWho((w) => flip(w, e))} className={`chip h-9 cursor-pointer px-3 ${on ? "chip-accent" : "chip-outline"}`}>
                  {on && <IconCheck size={12} />}{label(e)}
                </button>
              );
            })}
          </div>
        )}

        {sheet === "" ? (
          <div className="grid grid-cols-[64px_64px_1fr] gap-2">
            <Dim className="flex"><button type="button" onClick={() => setSheet("reject")} className="btn btn-ghost w-full" style={{ padding: "0 6px" }}>Bỏ</button></Dim>
            <Dim className="flex"><button type="button" onClick={() => setSheet("edit")} className="btn btn-ghost w-full" style={{ padding: "0 6px" }}>Sửa</button></Dim>
            <SubmitButton className="btn btn-accent" pendingLabel="Đang duyệt…" disabled={who.length === 0}>{approve}</SubmitButton>
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <Dim className="flex"><button type="button" onClick={() => setSheet("")} className="btn btn-ghost w-full">Thôi</button></Dim>
            {sheet === "reject"
              ? <SubmitButton className="btn btn-warn" pendingLabel="Đang bỏ…">Bỏ đề xuất</SubmitButton>
              : <SubmitButton className="btn btn-dark" pendingLabel="Đang lưu…">Lưu và duyệt</SubmitButton>}
          </div>
        )}
        {sheet === "" && who.length === 0 && <div className="text-xs text-bad">Chọn ít nhất một người dùng kỹ năng này.</div>}
      </form>
    </>
  );
}

function Option({ on, onPick, title, tag, children }: { on: boolean; onPick: () => void; title: string; tag?: string; children: React.ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-2xl bg-card px-4 py-3.5 ${on ? "border-[1.5px] border-accent" : "border border-line"}`}>
      <input type="radio" name="cach" checked={on} onChange={onPick} className="mt-0.5 h-5 w-5 flex-none accent-[#cf3d7a]" />
      <span className="flex flex-col gap-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-bold">{title}</span>
          {tag && <span className="chip chip-ok">{tag}</span>}
        </span>
        <span className="text-[13px] leading-relaxed text-muted">{children}</span>
      </span>
    </label>
  );
}
