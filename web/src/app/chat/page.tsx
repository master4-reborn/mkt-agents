import Link from "next/link";
import { requireBrand } from "@/lib/brands";
import { conversation, currentFiles } from "@/lib/sync";
import { knownStatus } from "@/lib/office";
import { parseReport, friendly, weekNo, fileRef, type FileRef } from "@/lib/parse";
import { Markdown } from "@/components/Markdown";
import { CatAvatar } from "@/components/CatAvatar";
import { ChatComposer } from "@/components/ChatComposer";
import { ScrollToEnd } from "@/components/ScrollToEnd";

export const dynamic = "force-dynamic";

type Msg = { id: string; role: string; text: string; createdAt: Date };

export default async function Chat() {
  const { id: sid } = await requireBrand();
  const [all, files, status] = await Promise.all([conversation(sid, 80), currentFiles(sid), knownStatus(sid)]);
  const refs: FileRef[] = files.map(fileRef);
  const titleOf = (name: string) => refs.find((r) => r.name === name)?.title ?? name;
  const msgs = all.filter((m) => m.role !== "status" && !isDebug(m));
  const waiting = files.filter((f) => f.kind === "draft" && f.status === "ready").length;
  const running = status.status === "running";
  // The lead is on your last message: show it typing until the answer lands.
  const replying = running && msgs[msgs.length - 1]?.role === "boss";

  return (
    <div className="flex flex-col gap-3.5 pb-[120px] lg:pb-0">
      <div className="flex items-center gap-2.5">
        <CatAvatar size={40} state={running ? "working" : "done"} />
        <div className="flex flex-col">
          <div className="text-[17px] font-bold">Trưởng nhóm</div>
          <div className="text-xs text-muted">{replying ? "đang trả lời · trang tự cập nhật mỗi 8 giây" : running ? "đang làm việc · trang tự cập nhật mỗi 8 giây" : "đang rảnh · trả lời trong 10 đến 15 giây"}</div>
        </div>
      </div>

      {msgs.length === 0 && <div className="card text-sm text-muted">Chưa có tin nhắn. Nhắn một câu tiếng Việt ở dưới.</div>}

      {msgs.map((m, i) => {
        const prev = msgs[i - 1];
        const newDay = !prev || prev.createdAt.toDateString() !== m.createdAt.toDateString();
        return (
          <div key={m.id} className="contents">
            {newDay && <div className="self-center rounded-full border border-line bg-card px-2.5 py-0.5 text-[11px] text-muted">{dayLabel(m.createdAt)}</div>}
            {m.role === "boss" ? <BossBubble m={m} titleOf={titleOf} /> : <LeadBubble m={m} refs={refs} waiting={i === msgs.length - 1 ? waiting : 0} />}
          </div>
        );
      })}

      {replying && (
        <div aria-live="polite" className="flex flex-col gap-1.5 self-start">
          <div className="flex items-center gap-2.5 rounded-[18px] rounded-bl-[4px] border border-line bg-card px-4 py-3.5">
            <span className="inline-flex items-center gap-1" aria-hidden><span className="dot" /><span className="dot" /><span className="dot" /></span>
            <span className="text-[13px] text-ink-soft">Trưởng nhóm đang trả lời…</span>
          </div>
          <div className="pl-1.5 text-[11px] text-muted">Thường 10 đến 15 giây. Bạn đóng trang cũng được, trả lời vẫn ở đây.</div>
        </div>
      )}

      <ScrollToEnd count={msgs.length + (replying ? 1 : 0)} />
      <ChatComposer waiting={waiting} running={running} />
    </div>
  );
}

function isDebug(m: Msg) {
  return /^Print the full contents/i.test(m.text) || /^=== \/workspace/.test(m.text) || /^Set up the office\./.test(m.text);
}

function dayLabel(d: Date) {
  const today = new Date();
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const y = new Date(today); y.setDate(y.getDate() - 1);
  return same(d, today) ? "Hôm nay" : same(d, y) ? "Hôm qua" : d.toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "numeric" });
}
const hhmm = (d: Date) => d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

// The boss's messages are mostly orders the page sent on their behalf; show what they meant.
function BossBubble({ m, titleOf }: { m: Msg; titleOf: (n: string) => string }) {
  let kind: string | null = null;
  let main = m.text;
  let sub: string | null = null;
  let x: RegExpMatchArray | null;
  if ((x = m.text.match(/^(?:Run week|Chạy tuần)\s+(\S+?)\.?\s*$/im))) {
    kind = "Lệnh"; main = `Chạy tuần ${weekNo(x[1])}`;
    const note = m.text.match(/(?:Boss's note for this week|Ghi chú của sếp cho tuần này):\s*([\s\S]*)$/i)?.[1]?.trim();
    sub = note && !/^(none|không có)$/i.test(note) ? `Ghi chú: ${note}` : null;
  } else if ((x = m.text.match(/^approve\s+(?:content\/drafts\/)?(\S+)/i))) {
    kind = "Đã duyệt"; main = titleOf(x[1]);
  } else if ((x = m.text.match(/^reject\s+(?:content\/drafts\/)?(\S+?):\s*([\s\S]*)$/i))) {
    kind = "Trả lại"; main = titleOf(x[1]); sub = x[2].trim();
  } else if ((x = m.text.match(/^New brand:\s*([\s\S]*)$/i))) {
    kind = "Thương hiệu mới"; main = x[1].trim();
  } else if ((x = m.text.match(/^Sửa thẻ thương hiệu .*?:\s*([\s\S]*)$/i))) {
    kind = "Sửa thương hiệu"; main = x[1].trim();
  } else if ((x = m.text.match(/^(?:Run metrics for|Chạy số liệu tuần)\s+(\S+)/i))) {
    kind = "Lệnh"; main = `Chạy số liệu tuần ${weekNo(x[1])}`;
  } else if ((x = m.text.match(/^Viết thêm 1 bài từ chủ đề (\d+)/i))) {
    kind = "Lệnh"; main = `Viết thêm bài từ chủ đề ${x[1]}`;
  }
  return (
    <div className="flex max-w-[82%] flex-col gap-1 self-end rounded-[18px] rounded-br-[4px] bg-ink px-3.5 py-3 text-white">
      {kind && <div className="eyebrow text-[#e9c3d4]">{kind}</div>}
      <div className={`whitespace-pre-line text-sm ${kind ? "font-semibold" : ""}`}>{main}</div>
      {sub && <div className="text-[13px] text-[#e9c3d4]">{sub}</div>}
      <div className="text-right text-[10px] text-[#e9c3d4]">{hhmm(m.createdAt)}</div>
    </div>
  );
}

function LeadBubble({ m, refs, waiting }: { m: Msg; refs: FileRef[]; waiting: number }) {
  const r = parseReport(m.text);
  const wrap = "flex max-w-[92%] flex-col gap-2.5 self-start rounded-[18px] rounded-bl-[4px] border border-line bg-card p-3.5";
  if (!r)
    return (
      <div className={wrap}>
        <Markdown className="text-sm">{friendly(m.text, refs)}</Markdown>
        <div className="text-[10px] text-muted">{hhmm(m.createdAt)}</div>
      </div>
    );
  const links = linksIn(friendly(r.files, refs));
  return (
    <div className={wrap}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[13px] font-bold">Báo cáo</div>
        <div className="text-[11px] text-muted">{hhmm(m.createdAt)}</div>
      </div>
      <div className="flex flex-col gap-2">
        {r.done && <Row label="Đã làm" color="text-ok-deep"><Markdown className="text-sm">{friendly(r.done, refs)}</Markdown></Row>}
        {links.length > 0 && (
          <Row label="File" color="text-muted">
            <span className="flex flex-wrap gap-1.5">{links.map((l) => <Link key={l.href} href={l.href} className="chip chip-outline text-ink">{l.text}</Link>)}</span>
          </Row>
        )}
        {r.needs && <Row label="Cần bạn" color="text-accent-deep"><Markdown className="text-sm">{friendly(r.needs, refs)}</Markdown></Row>}
      </div>
      {r.more && (
        <details className="text-sm">
          <summary className="cursor-pointer text-[13px] font-semibold text-accent-deep">Chi tiết</summary>
          <Markdown className="mt-2 text-sm">{friendly(r.more, refs)}</Markdown>
        </details>
      )}
      {waiting > 0 && /duyệt|approve|decide/i.test(r.needs) && <Link href="/drafts" className="btn btn-sm btn-soft">Mở {waiting} bài chờ duyệt</Link>}
    </div>
  );
}

function Row({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[64px_1fr] gap-2">
      <span className={`pt-[3px] text-[11px] font-bold uppercase tracking-wider ${color}`}>{label}</span>
      <span className="min-w-0 text-sm leading-relaxed">{children}</span>
    </div>
  );
}

function linksIn(mdText: string): { text: string; href: string }[] {
  const out: { text: string; href: string }[] = [];
  for (const m of mdText.matchAll(/\[([^\]]+)\]\((\/[^)]+)\)/g)) if (!out.some((o) => o.href === m[2])) out.push({ text: m[1].replace(/^“|”$/g, ""), href: m[2] });
  return out;
}
