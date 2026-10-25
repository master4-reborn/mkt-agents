import Link from "next/link";
import { requireBrand } from "@/lib/brands";
import { currentFiles, memoryFiles } from "@/lib/sync";
import { knownStatus, memoryStoreId, type OfficeStatus } from "@/lib/office";
import { SubmitButton } from "@/components/SubmitButton";
import { IconPlus, IconX } from "@/components/Icons";
import { parseFile, brandCard, md, type Field } from "@/lib/parse";
import { lessonLines, BRAND_FILES, SEP_FILES } from "@/lib/memory";
import type { Brand as BrandRow } from "@/lib/brands";
import { askBrand, addLesson, forgetLine, reopen, toggleSchedule } from "../actions";
import { Sources } from "./Sources";

export const dynamic = "force-dynamic";

export default async function Brand() {
  const me = await requireBrand();
  const sep = memoryStoreId();
  const [brandRows, status, mine, shared] = await Promise.all([
    currentFiles(me.id, "brand"),
    knownStatus(me.id),
    me.memoryStoreId ? memoryFiles(me.memoryStoreId) : Promise.resolve([]),
    sep ? memoryFiles(sep) : Promise.resolve([]),
  ]);
  const brand = brandRows[0] ?? null;
  const p = brand ? parseFile(brand.name, brand.content) : null;
  const card = p ? brandCard(p.body) : [];
  const field = (sec: RegExp, lab: RegExp) => card.find((s) => sec.test(s.title))?.fields.find((f) => lab.test(f.label));
  const shopName = field(/^Shop/i, /tên/i)?.value ?? "Thương hiệu";
  const niche = field(/^Shop/i, /ngách/i)?.value ?? "";
  const channel = field(/^Kênh/i, /kênh đăng/i)?.value ?? "";
  const ready = brand?.status === "ready";

  if (!brand || !p)
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Thương hiệu</h1>
        <section className="flex flex-col gap-3 rounded-[20px] bg-accent-soft p-5">
          <div className="eyebrow text-accent-deep">{status.status === "running" ? "Đang viết" : "Chưa có thẻ"}</div>
          <div className="text-[22px] font-bold leading-tight">{status.status === "running" ? "Đội đang viết thẻ thương hiệu" : "Thẻ thương hiệu chưa về"}</div>
          <div className="text-sm text-[#6b3d53]">Bạn đã nói: “{me.sentence}”. {status.status === "running" ? "Mất khoảng 3 phút; trưởng nhóm sẽ hỏi lại bạn tối đa 3 câu." : "Xem trưởng nhóm đang cần gì ở bạn."}</div>
          <Link href="/chat" className="btn btn-accent">Xem trưởng nhóm</Link>
        </section>
        <Reopen me={me} status={status} />
        <AddBrand />
      </div>
    );

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <span className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-2xl bg-ink text-xl font-bold text-white">{shopName.trim().charAt(0).toUpperCase()}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="truncate text-[22px] font-bold">{shopName}</h1>
          <div className="truncate text-xs text-muted">{[channel, niche].filter(Boolean).join(" · ")}</div>
        </div>
        <span className={`chip ${ready ? "chip-ok" : "chip-warn"}`}>{ready ? "Sẵn sàng" : "Đang hoàn thiện"}</span>
      </div>
      <p className="text-[13px] leading-relaxed text-muted">Đội đọc thẻ này trước mỗi tuần. Dòng nào ghi <i>ước tính</i> là đội đoán, bạn sửa bằng một câu ở dưới.</p>

      {card.map((s) => (
        <section key={s.title} className="overflow-hidden rounded-[18px] border border-line bg-card">
          <div className="px-4 pb-1.5 pt-3 text-xs font-bold uppercase tracking-wider text-muted">{s.title}</div>
          {s.fields.filter((f) => !/^tên shop$/i.test(f.label)).map((f) => <FieldRow key={f.label} f={f} />)}
          {s.items.map((it, i) => /đối thủ/i.test(s.title) ? <CompetitorRow key={i} text={it} /> : <div key={i} className="row text-sm leading-relaxed">{it}</div>)}
          {s.fields.length === 0 && s.items.length === 0 && <div className="row text-sm text-muted">chưa có</div>}
        </section>
      ))}

      <form action={askBrand} className="card flex flex-col gap-2">
        <div className="text-[15px] font-bold">Sửa thẻ</div>
        <div className="text-[13px] text-muted">Nói một câu, đội tự sửa đúng dòng. Ví dụ: “lịch đăng là thứ 3 và thứ 5, 20h”.</div>
        <input name="text" className="input" placeholder="Muốn đổi gì?" required />
        <SubmitButton className="btn btn-sm btn-dark" pendingLabel="Đang gửi…">Gửi cho đội</SubmitButton>
      </form>

      <Schedule on={me.schedule === "mon"} />

      <Sources me={me} />

      {me.memoryStoreId ? (
        <Memory
          id="doi-da-hoc"
          title="Đội đã học"
          intro="Rút ra từ lời bạn trả lại bài, từ số liệu và từ khách hỏi; đội đọc lại trước mỗi bài. Dòng nào sai, xóa là đội quên từ chu trình sau."
          store={me.memoryStoreId}
          files={mine}
          groups={BRAND_FILES}
          scope="brand"
          placeholder="Thêm bài học cho thương hiệu này, một câu"
        />
      ) : (
        <Reopen me={me} status={status} />
      )}
      {sep && (
        <Memory
          id="so-thich"
          title="Sở thích của sếp"
          intro="Áp dụng cho mọi thương hiệu: cách bạn thích bài, điều số liệu đã chứng minh, từ cấm ở mọi shop. Sửa ở đây là sửa cho tất cả."
          store={sep}
          files={shared}
          groups={SEP_FILES}
          scope="sep"
          placeholder="Thêm sở thích cho mọi thương hiệu, một câu"
        />
      )}
      {me.memoryStoreId && <Reopen me={me} status={status} />}

      <AddBrand />
    </div>
  );
}

type MemoryFile = { path: string; content: string };

// One memory store as the boss sees it: its files as lists of lines, newest first, each line deletable, one input to add.
function Memory({ id, title, intro, store, files, groups, scope, placeholder }: { id: string; title: string; intro: string; store: string; files: MemoryFile[]; groups: [string, string][]; scope: "brand" | "sep"; placeholder: string }) {
  return (
    <section id={id} className="flex flex-col gap-2 scroll-mt-4">
      <h2 className="text-[15px] font-bold">{title}</h2>
      <p className="text-[13px] leading-relaxed text-muted">{intro}</p>
      <div className="overflow-hidden rounded-[18px] border border-line bg-card">
        {groups.map(([path, label]) => {
          const lines = lessonLines(files.find((f) => f.path === path)?.content ?? "");
          return (
            <div key={path}>
              <div className="px-4 pb-1.5 pt-3 text-xs font-bold uppercase tracking-wider text-muted">{label} · {lines.length}</div>
              {lines.length === 0 && <div className="row text-sm text-muted">chưa có</div>}
              {lines.map((l) => (
                <div key={l.text} className="row items-start">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {l.date && <span className="text-[11px] text-muted">{dateLabel(l.date)}</span>}
                    <span className="text-sm leading-relaxed">{l.rest}</span>
                  </div>
                  <form action={forgetLine} className="flex-none">
                    <input type="hidden" name="store" value={store} />
                    <input type="hidden" name="path" value={path} />
                    <input type="hidden" name="text" value={l.text} />
                    <SubmitButton className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted" iconOnly pendingLabel="Đang xóa…" ariaLabel="Xóa dòng này" spinnerSize={14}><IconX size={12} /></SubmitButton>
                  </form>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <form action={addLesson} className="flex gap-2">
        <input type="hidden" name="scope" value={scope} />
        <input name="text" className="input min-w-0 flex-1" placeholder={placeholder} required maxLength={300} autoComplete="off" />
        <SubmitButton className="btn btn-dark flex-none" pendingLabel="Đang ghi…">Thêm</SubmitButton>
      </form>
    </section>
  );
}

// Monday mornings the cron sends "Chạy tuần mới" for this brand (vercel.json → /api/cron/week), once per week, never
// while the team is busy or the office has stopped. Off by default: the boss runs weeks from the home page.
function Schedule({ on }: { on: boolean }) {
  const next = new Date();
  next.setDate(next.getDate() + ((8 - next.getDay()) % 7 || 7));
  const nextLabel = next.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  const armed = !!process.env.CRON_SECRET;
  return (
    <section id="lich" className="card flex flex-col gap-2 scroll-mt-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[15px] font-bold">Lịch chạy tuần</div>
        <span className={`chip ${on ? "chip-ok" : "chip-outline"}`}>{on ? "Đang bật" : "Đang tắt"}</span>
      </div>
      <div className="text-[13px] leading-relaxed text-muted">
        {on
          ? `Sáng thứ Hai, 8 đến 9 giờ, đội tự nghiên cứu và viết bài tuần mới; bạn chỉ cần vào duyệt. Lần tới: thứ Hai ${nextLabel}. Tuần nào bạn đã bấm Chạy tuần mới thì đội không chạy thêm.`
          : "Đội chỉ chạy khi bạn bấm Chạy tuần mới ở trang Hôm nay. Bật lịch để sáng thứ Hai đội tự làm, 2 đến 3 USD mỗi tuần."}
        {on && !armed && " Máy chủ này chưa cài lịch, nên lịch chưa chạy được."}
      </div>
      <form action={toggleSchedule}>
        <input type="hidden" name="on" value={on ? "0" : "1"} />
        <SubmitButton className={`btn btn-sm ${on ? "btn-soft" : "btn-dark"}`} pendingLabel="Đang lưu…">{on ? "Tắt lịch" : "Bật lịch sáng thứ Hai"}</SubmitButton>
      </form>
    </section>
  );
}

// "2026-10-25" → "25/10", "2026-W43" → "tuần 43".
function dateLabel(d: string) {
  const w = d.match(/^\d{4}-W(\d{2})$/);
  if (w) return `tuần ${Number(w[1])}`;
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
}

// A stopped office gets a new session on the same memory; an office from before memory existed gets memory this way.
function Reopen({ me, status }: { me: BrandRow; status: OfficeStatus }) {
  const stopped = status.status === "terminated" || (status.budgetUsd != null && status.listCostUsd >= status.budgetUsd);
  if (!stopped && (me.memoryStoreId || status.status === "running")) return null;
  return (
    <form action={reopen} className="card flex flex-col gap-2">
      <div className="text-[15px] font-bold">{stopped ? "Văn phòng đã dừng" : "Bật bộ nhớ cho thương hiệu này"}</div>
      <div className="text-[13px] leading-relaxed text-muted">
        {stopped
          ? "Hết ngân sách hoặc phiên đã kết thúc. Mở lại thì đội giữ nguyên thẻ, bài và mọi điều đã học, chỉ có ngân sách mới."
          : "Văn phòng này mở trước khi đội có bộ nhớ nên chưa học được gì. Mở lại để đội bắt đầu học; thẻ và bài cũ giữ nguyên."}
      </div>
      <select name="budget" className="input" defaultValue="30">
        <option value="10">10 USD · khoảng 3 tuần</option>
        <option value="30">30 USD · khoảng 10 tuần</option>
        <option value="50">50 USD · khoảng 18 tuần</option>
      </select>
      <SubmitButton className="btn btn-accent" pendingLabel="Đang mở lại…">Mở lại văn phòng</SubmitButton>
    </form>
  );
}

// Each brand has its own office; a second brand never touches this one's card, posts or budget.
function AddBrand() {
  return (
    <Link href="/brand/new" className="card flex items-center gap-3 text-ink">
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-dashed border-accent text-accent-deep"><IconPlus size={18} /></span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-bold">Thêm thương hiệu khác</span>
        <span className="text-xs text-muted">Văn phòng riêng, ngân sách riêng. Đổi qua lại ở đầu trang.</span>
      </span>
    </Link>
  );
}

function FieldRow({ f }: { f: Field }) {
  const isBanned = /từ cấm/i.test(f.label);
  // "Từ cấm" groups are numbered lines of quoted words; show each word as a pill.
  const words = isBanned ? [...new Set(f.items.filter((it) => !/^Cách nói thay/i.test(it)).flatMap((it) => [...it.matchAll(/"([^"]+)"|“([^”]+)”/g)].map((m) => m[1] ?? m[2])))] : [];
  const extra = isBanned ? f.items.filter((it) => /^Cách nói thay/i.test(it)) : [];
  return (
    <div className="row items-start">
      <span className="row-label pt-0.5">{f.label}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm leading-relaxed">
        {f.value && !(isBanned && words.length) && <span>{f.value} {f.estimated && <Est />}</span>}
        {isBanned && words.length > 0 ? (
          <>
            <span className="flex flex-wrap gap-1.5">{words.map((w) => <span key={w} className="chip chip-outline text-ink">{w}</span>)}</span>
            {extra.map((e, i) => <span key={i} className="text-xs text-muted">{md(e)}</span>)}
          </>
        ) : f.items.length > 0 ? (
          <ul className="flex flex-col gap-0.5">{f.items.map((it, i) => <li key={i}>{it.replace(/^\d+\.\s*/, "")}</li>)}</ul>
        ) : null}
        {!f.value && f.items.length === 0 && <span className="text-muted">chưa có</span>}
      </span>
    </div>
  );
}

// "Name (place): web https://… · TikTok https://…. Đáng học: …" → name, link chips, note.
function CompetitorRow({ text }: { text: string }) {
  const urls = [...text.matchAll(/https?:\/\/[^\s)·,]+/g)].map((m) => m[0].replace(/[.,]$/, ""));
  const name = text.split(/[:(]/)[0].trim();
  const note = text.replace(/https?:\/\/[^\s)·,]+/g, "").replace(/^[^:]*\([^)]*\)?:?\s*/, "").replace(/^(?:web|TikTok|Threads|Facebook)\s*[·.]?\s*/gi, "").replace(/\s*[·.]\s*(?:web|TikTok|Threads|Facebook)\s*/gi, " ").replace(/\s{2,}/g, " ").replace(/^[\s.·]+/, "").trim();
  const host = (u: string) => { const m = u.match(/^https?:\/\/(?:www\.)?([^/]+)\/?(@[\w.]+)?/); return m ? (m[2] ? `${m[1].replace(/\.com$/, "")} ${m[2]}` : m[1]) : u; };
  return (
    <div className="row items-start">
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent-soft text-[13px] font-bold text-accent-deep">{name.charAt(0).toUpperCase()}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="text-sm font-semibold">{name}</div>
        {urls.length > 0 && <div className="flex flex-wrap gap-1.5">{urls.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer" className="chip chip-outline text-accent-deep">{host(u)}</a>)}</div>}
        {note && <div className="text-[13px] leading-relaxed text-ink-soft">{note}</div>}
      </div>
    </div>
  );
}

const Est = () => <span className="chip chip-accent px-1.5 py-0 text-[11px] font-medium">ước tính</span>;
