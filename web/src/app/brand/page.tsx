import Link from "next/link";
import { requireBrand } from "@/lib/brands";
import { currentFiles } from "@/lib/sync";
import { knownStatus } from "@/lib/office";
import { SubmitButton } from "@/components/SubmitButton";
import { IconPlus } from "@/components/Icons";
import { parseFile, brandCard, md, type Field } from "@/lib/parse";
import { askBrand } from "../actions";

export const dynamic = "force-dynamic";

export default async function Brand() {
  const me = await requireBrand();
  const [brandRows, status] = await Promise.all([currentFiles(me.id, "brand"), knownStatus(me.id)]);
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

      <AddBrand />
    </div>
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
