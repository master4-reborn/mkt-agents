import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBrand } from "@/lib/brands";
import { fileByName, currentFiles, conversation } from "@/lib/sync";
import { knownStatus } from "@/lib/office";
import { parseFile, splitDraft, postParts, placeholders, qaChecklist, bossNotes, sourceNotes, painPoint, commentQuotes, replyParts, postLength, POST_LIMIT, QA_LABEL, STATUS_LABEL, weekNo, md } from "@/lib/parse";
import { CopyButton } from "@/components/CopyButton";
import { SubmitButton, Dim } from "@/components/SubmitButton";
import { IconBack, IconCheck, IconChevron, IconX } from "@/components/Icons";
import { decide, markPosted, draftReply } from "../../actions";

export const dynamic = "force-dynamic";

export default async function Draft({ params }: { params: Promise<{ name: string }> }) {
  const { id: sid } = await requireBrand();
  const { name } = await params;
  const f = await fileByName(sid, decodeURIComponent(name));
  if (!f || f.kind !== "draft") notFound();
  const [drafts, brandRows, research, replyFiles, convo, office] = await Promise.all([currentFiles(sid, "draft"), currentFiles(sid, "brand"), currentFiles(sid, "research"), currentFiles(sid, "reply"), conversation(sid, 4), knownStatus(sid)]);
  const p = parseFile(f.name, f.content);
  const { post } = splitDraft(p.body);
  const holes = placeholders(post);
  const qa = qaChecklist(p.body);
  const notes = bossNotes(p.body);
  const sources = sourceNotes(p.body);
  const pain = painPoint(p.data.pain_point);
  const channel = String(p.data.channel ?? "threads").toLowerCase();
  const limit = POST_LIMIT[channel] ?? 500;
  const len = postLength(post);
  const pct = Math.min(100, Math.round((len / limit) * 100));
  const waiting = drafts.filter((d) => d.status === "ready");
  const pos = waiting.findIndex((d) => d.name === f.name);
  const brand = brandRows[0] ? parseFile(brandRows[0].name, brandRows[0].content) : null;
  const shop = brand?.body.match(/\*\*Tên shop:\*\*\s*(.+)/)?.[1]?.trim() ?? "Shop của bạn";
  const comments = research.find((r) => r.week === f.week && /-comments\.md$/.test(r.name));
  const quotes = comments ? commentQuotes(parseFile(comments.name, comments.content).body).filter((q) => pain.codes.includes(q.code)) : [];
  const status = f.status ?? "";
  const canDecide = status === "ready";
  const out = status === "approved" || status === "posted";
  const replies = replyFiles.map((r) => ({ ...r, p: parseFile(r.name, r.content) })).filter((r) => String(r.p.data.post ?? "") === f.name).map((r) => ({ name: r.name, status: r.status, ...replyParts(r.p.body) }));
  const lastBoss = [...convo].reverse().find((m) => m.role === "boss");
  const drafting = office.status === "running" && !!lastBoss && lastBoss.text.startsWith(`Khách bình luận dưới bài ${f.name}:`);

  return (
    <div className="flex flex-col gap-3.5 pb-[150px] lg:pb-0">
      <div className="flex items-center gap-2.5">
        <Link href="/drafts" aria-label="Quay lại danh sách bài" className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-card text-ink"><IconBack /></Link>
        <div className="text-sm font-semibold">{canDecide && pos >= 0 ? `Bài ${pos + 1} / ${waiting.length} chờ duyệt` : f.title}</div>
        <span className={`chip ml-auto ${status === "ready" ? "chip-accent" : status === "approved" || status === "posted" ? "chip-ok" : "chip-warn"}`}>{STATUS_LABEL[status] ?? status}</span>
      </div>

      <section aria-label={`Bài sẽ hiện trên ${channel}`} className="card flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-[15px] font-bold text-white">{shop.trim().charAt(0).toUpperCase()}</span>
          <div className="flex flex-col">
            <div className="text-sm font-bold">{shop}</div>
            <div className="text-xs text-muted">{channel.charAt(0).toUpperCase() + channel.slice(1)} · tuần {weekNo(f.week)}{p.data.product ? ` · ${md(String(p.data.product)).split(/[,(]/)[0].trim()}` : ""}</div>
          </div>
        </div>
        <p className="whitespace-pre-line text-[15px] leading-[1.55]">
          {postParts(post).map((part, i) => part.placeholder ? <mark key={i} className="placeholder">[{part.text}]</mark> : <span key={i}>{part.text}</span>)}
        </p>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-muted"><span>{len} / {limit} ký tự</span><span>{len > limit ? "quá dài" : pct > 90 ? "vừa khít" : "còn chỗ"}</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-line-soft"><div className={`h-full ${len > limit ? "bg-bad" : "bg-accent"}`} style={{ width: `${pct}%` }} /></div>
        </div>
      </section>

      {holes.length > 0 && (
        <section className="flex flex-col gap-2 rounded-[18px] border border-warn-line bg-warn-soft p-4 text-warn">
          <div className="eyebrow text-warn">Còn {holes.length} chỗ trống</div>
          <ul className="flex flex-col gap-1 text-sm">{holes.map((h, i) => <li key={i}>• {h}</li>)}</ul>
          <div className="text-xs">Bạn tự điền khi đăng, hoặc trả lại bài kèm số liệu để đội sửa.</div>
        </section>
      )}

      <section className="card flex flex-col gap-2.5">
        <div className="eyebrow">Vì sao viết bài này</div>
        {pain.summary && <div className="text-sm leading-relaxed"><b>Nỗi đau khách đang kêu:</b> {pain.summary}.</div>}
        {quotes.slice(0, 2).map((q) => (
          <blockquote key={q.code} className="m-0 rounded-r-[10px] border-l-[3px] border-line bg-bg px-3 py-2 text-[13px] leading-relaxed text-ink-soft">
            “{q.quote}” <span className="text-muted">· {q.source}</span>
          </blockquote>
        ))}
        {notes.length > 0 && (
          <div className="flex flex-col gap-1 pt-1">
            <div className="text-xs font-semibold text-accent-deep">Người viết nhắn bạn</div>
            <ul className="flex flex-col gap-1 text-[13px] leading-relaxed text-ink-soft">{notes.map((n, i) => <li key={i}>• {md(n)}</li>)}</ul>
          </div>
        )}
        <Link href="/research?tab=noi-dau" className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent-deep">Xem bảng nỗi đau tuần {weekNo(f.week)} <IconChevron size={14} /></Link>
      </section>

      {qa && (
        <section className="card flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <div className="eyebrow">QA đã kiểm{qa.round > 1 ? ` · lần ${qa.round}` : ""}</div>
            <div className={`text-xs font-semibold ${qa.items.every((i) => i.pass) ? "text-ok-deep" : "text-bad"}`}>{qa.items.filter((i) => i.pass).length} / {qa.items.length} đạt</div>
          </div>
          <ul className="flex flex-col gap-2 text-sm">
            {qa.items.map((it) => (
              <li key={it.n} className="flex items-center gap-2.5">
                <span className={`flex h-5 w-5 flex-none items-center justify-center rounded-full ${it.pass ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>{it.pass ? <IconCheck size={12} /> : <IconX size={12} />}</span>
                <span className={it.pass ? "" : "font-semibold"}>{QA_LABEL[it.n] ?? md(it.text).split(/[:.;]/)[0]}</span>
              </li>
            ))}
          </ul>
          <details className="pt-1 text-[13px]">
            <summary className="cursor-pointer font-semibold text-accent-deep">Chi tiết QA và nguồn</summary>
            <ul className="mt-2 flex flex-col gap-1.5 leading-relaxed text-ink-soft">
              {qa.items.map((it) => <li key={it.n}>{it.n}. {md(it.text)}</li>)}
            </ul>
            {sources.length > 0 && (
              <>
                <div className="mt-3 text-xs font-semibold text-muted">Nguồn</div>
                <ul className="mt-1 flex flex-col gap-1.5 leading-relaxed text-ink-soft">
                  {sources.map((s, i) => <li key={i}>• {md(s).replace(/https?:\/\/\S+/g, (u) => u.replace(/^https?:\/\//, "").split("/")[0])}</li>)}
                </ul>
              </>
            )}
          </details>
        </section>
      )}

      {out && (
        <section id="tra-loi" className="card flex flex-col gap-3">
          <div className="eyebrow">Khách bình luận</div>
          {replies.map((r) => (
            <div key={r.name} className="flex flex-col gap-2 rounded-[14px] border border-line bg-bg p-3">
              <blockquote className="m-0 text-[13px] leading-relaxed text-ink-soft">“{r.comment}”</blockquote>
              <div className="flex items-start gap-2">
                <span className={`chip flex-none ${r.status === "ready" ? "chip-ok" : "chip-warn"}`}>{r.status === "ready" ? "Sẵn sàng" : "Đang soạn"}</span>
                <p className="min-w-0 flex-1 whitespace-pre-line text-sm leading-relaxed">{r.reply}</p>
              </div>
              {r.reply && <CopyButton text={r.reply} className="btn btn-xs btn-soft self-start" label="Sao chép trả lời" />}
            </div>
          ))}
          {drafting && (
            <div aria-live="polite" className="flex items-center gap-2 text-[13px] text-ink-soft">
              <span className="inline-flex items-center gap-1" aria-hidden><span className="dot" /><span className="dot" /><span className="dot" /></span>
              Đội đang soạn trả lời, khoảng 1 phút. Trang tự cập nhật.
            </div>
          )}
          <form action={draftReply} className="flex flex-col gap-2">
            <input type="hidden" name="name" value={f.name} />
            <label htmlFor="comment" className="text-[13px] text-muted">Dán bình luận của khách, đội soạn câu trả lời đúng giọng. Bạn tự gửi, đội không gửi.</label>
            <textarea id="comment" name="comment" rows={2} className="input" placeholder="Ví dụ: “giá bao nhiêu v shop”" required />
            <SubmitButton className="btn btn-sm btn-dark" pendingLabel="Đang gửi…">Nhờ đội soạn trả lời</SubmitButton>
          </form>
        </section>
      )}

      {f.decision && status !== "ready" && (
        <p className="text-center text-xs text-muted">
          Bạn đã {f.decision.decision === "approved" ? "duyệt" : f.decision.decision === "posted" ? "đăng" : "trả lại"} lúc {f.decision.createdAt.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}{f.decision.note ? `: ${f.decision.note}` : ""}.
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2 border-t border-line bg-card px-4 pt-3 lg:static lg:rounded-[18px] lg:border lg:p-4" style={{ paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}>
        {canDecide ? (
          <>
            <input type="checkbox" id="reject" className="peer sr-only" />
            <form action={decide} className="grid grid-cols-[1fr_2fr] gap-2.5 peer-checked:hidden">
              <input type="hidden" name="name" value={f.name} />
              <input type="hidden" name="decision" value="approved" />
              <Dim className="flex"><label htmlFor="reject" className="btn btn-warn w-full cursor-pointer select-none">Trả lại</label></Dim>
              <SubmitButton className="btn btn-ok text-base" pendingLabel="Đang gửi…"><IconCheck size={18} /> Duyệt bài này</SubmitButton>
            </form>
            <form action={decide} className="hidden flex-col gap-2 peer-checked:flex">
              <input type="hidden" name="name" value={f.name} />
              <input type="hidden" name="decision" value="rejected" />
              <input name="note" className="input" placeholder="Vì sao trả lại? Ví dụ: 2 túi mỗi bình 500ml, ủ 8 tiếng" required />
              <div className="grid grid-cols-[1fr_2fr] gap-2.5">
                <Dim className="flex"><label htmlFor="reject" className="btn btn-ghost w-full cursor-pointer select-none">Thôi</label></Dim>
                <SubmitButton className="btn btn-warn" pendingLabel="Đang gửi lại…">Gửi lại cho đội sửa</SubmitButton>
              </div>
            </form>
            <div className="text-center text-xs text-muted">Sau khi duyệt, bạn tự đăng. Đội không có nút gửi.</div>
          </>
        ) : status === "approved" ? (
          <>
            <div className="grid grid-cols-[1fr_1fr] gap-2.5">
              <CopyButton text={post} className="btn btn-soft" label="Sao chép bài" />
              <form action={markPosted} className="contents">
                <input type="hidden" name="name" value={f.name} />
                <SubmitButton className="btn btn-ok" pendingLabel="Đang ghi…"><IconCheck size={18} /> Đã đăng</SubmitButton>
              </form>
            </div>
            <div className="text-center text-xs text-muted">Dán lên {channel.charAt(0).toUpperCase() + channel.slice(1)}, rồi bấm Đã đăng.</div>
          </>
        ) : status === "posted" ? (
          <CopyButton text={post} className="btn btn-ghost" label="Sao chép lại bài" />
        ) : (
          <div className="text-center text-sm text-muted">Đội đang sửa bài này. Bạn sẽ thấy nó ở Chờ duyệt khi xong.</div>
        )}
      </div>
    </div>
  );
}
