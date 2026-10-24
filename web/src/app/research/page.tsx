import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { sync, currentFiles } from "@/lib/sync";
import { parseFile, topicsList, painTable, commentQuotes, competitorTable, topicNumber, weekNo, md, STATUS_LABEL } from "@/lib/parse";
import { writeTopic } from "../actions";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "chu-de", label: "Chủ đề", file: /-topics\.md$/ },
  { key: "noi-dau", label: "Nỗi đau", file: /-comments\.md$/ },
  { key: "doi-thu", label: "Đối thủ", file: /-competitors\.md$/ },
];

export default async function Research({ searchParams }: { searchParams: Promise<{ tab?: string; week?: string }> }) {
  await requireAuth();
  const { tab, week: wantWeek } = await searchParams;
  await sync().catch(() => {});
  const [research, drafts] = await Promise.all([currentFiles("research"), currentFiles("draft")]);
  const weeks = [...new Set(research.map((r) => r.week).filter((w): w is string => !!w))].sort().reverse();
  const week = wantWeek && weeks.includes(wantWeek) ? wantWeek : weeks[0];
  const mine = research.filter((r) => r.week === week);
  const fileFor = (re: RegExp) => mine.find((r) => re.test(r.name));
  const parsed = (re: RegExp) => { const f = fileFor(re); return f ? parseFile(f.name, f.content) : null; };
  const topics = parsed(TABS[0].file);
  const comments = parsed(TABS[1].file);
  const competitors = parsed(TABS[2].file);
  const counts = {
    "chu-de": topics ? topicsList(topics.body).length : 0,
    "noi-dau": comments ? painTable(comments.body).length : 0,
    "doi-thu": competitors ? competitorTable(competitors.body).length : 0,
  } as Record<string, number>;
  const current = TABS.find((t) => t.key === tab) ?? TABS[0];
  const latest = mine.map((r) => r.createdAt).sort((a, b) => b.getTime() - a.getTime())[0];
  const draftByTopic = new Map<number, { name: string; title: string; status: string | null }>();
  for (const d of drafts.filter((d) => d.week === week)) {
    const n = topicNumber(parseFile(d.name, d.content).data.topic);
    if (n) draftByTopic.set(n, d);
  }
  const partial = [topics, comments, competitors].find((p) => p?.status === "partial" && p.statusNote);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Nghiên cứu</h1>
        {week && <div className="text-xs text-muted">tuần {weekNo(week)}{latest ? ` · xong ${latest.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : ""}</div>}
      </div>

      {weeks.length === 0 ? (
        <div className="card text-sm text-muted">Chưa có nghiên cứu. Chạy tuần mới để đội quét đối thủ và bình luận.</div>
      ) : (
        <>
          <div role="tablist" aria-label="Loại nghiên cứu" className="tabs grid-cols-3">
            {TABS.map((t) => (
              <Link key={t.key} href={`/research?tab=${t.key}${week ? `&week=${week}` : ""}`} role="tab" aria-current={t === current ? "page" : undefined} className="tab">{t.label} · {counts[t.key]}</Link>
            ))}
          </div>

          {current.key === "chu-de" && topics && <Topics body={topics.body} week={week!} draftByTopic={draftByTopic} />}
          {current.key === "noi-dau" && comments && <Pains body={comments.body} />}
          {current.key === "doi-thu" && competitors && <Competitors body={competitors.body} />}
          {!parsed(current.file) && <div className="card text-sm text-muted">Tuần này chưa có file {current.label.toLowerCase()}.</div>}

          {partial && (
            <div className="rounded-[14px] border border-line bg-card px-4 py-3 text-xs leading-relaxed text-muted">
              <b className="text-ink">{STATUS_LABEL.partial}:</b> {md(partial.statusNote!)}
            </div>
          )}
          {weeks.length > 1 && (
            <div className="flex flex-wrap gap-1.5 text-xs">
              {weeks.map((w) => <Link key={w} href={`/research?tab=${current.key}&week=${w}`} className={`chip ${w === week ? "chip-dark" : "chip-outline"}`}>tuần {weekNo(w)}</Link>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const Num = ({ n, soft }: { n: string | number; soft?: boolean }) => (
  <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-[10px] text-sm font-bold ${soft ? "bg-accent-soft text-accent-deep" : "bg-ink text-white"}`}>{n}</span>
);

function Topics({ body, week, draftByTopic }: { body: string; week: string; draftByTopic: Map<number, { name: string; title: string; status: string | null }> }) {
  const list = topicsList(body);
  const pick = (t: (typeof list)[number], re: RegExp) => t.fields.find((f) => re.test(f.label))?.value ?? "";
  return (
    <>
      <p className="text-[13px] leading-relaxed text-muted">Xếp theo mức khách đang kêu nhiều nhất tuần này. Chủ đề đã thành bài có nhãn xanh.</p>
      {list.map((t) => {
        const d = draftByTopic.get(t.n);
        const pain = pick(t, /nỗi đau/i).replace(/\s*\(\[?BL\]?[^)]*\)/g, "").replace(/\[BL\]\s*/g, "");
        const product = pick(t, /sản phẩm/i);
        return (
          <article key={t.n} className={`flex gap-3 rounded-[18px] border bg-card px-4 py-3.5 ${d ? "border-line" : "border-dashed border-[#e9bfd1]"}`}>
            <Num n={t.n} soft={!d} />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <h2 className="text-[15px] font-bold leading-snug">{t.title}</h2>
              {pain && <div className="text-[13px] leading-relaxed text-ink-soft">{pain}</div>}
              {product && <div className="text-xs text-muted">Sản phẩm: {product}</div>}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs">
                {d ? (
                  <Link href={`/drafts/${encodeURIComponent(d.name)}`} className="chip chip-ok">{d.status === "approved" || d.status === "posted" ? "đã duyệt" : d.status === "ready" ? "đã thành bài, chờ duyệt" : "đang sửa"}</Link>
                ) : (
                  <form action={writeTopic}>
                    <input type="hidden" name="week" value={week} />
                    <input type="hidden" name="n" value={t.n} />
                    <button className="chip h-[30px] border border-accent bg-card px-2.5 text-accent-deep">Viết bài này</button>
                  </form>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </>
  );
}

function Pains({ body }: { body: string }) {
  const pains = painTable(body);
  const quotes = commentQuotes(body);
  return (
    <>
      <p className="text-[13px] leading-relaxed text-muted">Những gì khách nói công khai trên mạng tuần này, gom theo nhóm. Số bên phải là số nguồn khác nhau có nhắc tới.</p>
      {pains.map((p) => {
        const qs = quotes.filter((q) => q.code.startsWith(p.group));
        return (
          <article key={p.group} className="flex gap-3 rounded-[18px] border border-line bg-card px-4 py-3.5">
            <Num n={p.group} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-[15px] font-bold leading-snug">{p.pain}</h2>
                {p.count != null && <span className="chip chip-outline flex-none">{p.count} nguồn</span>}
              </div>
              {qs.slice(0, 2).map((q) => (
                <blockquote key={q.code} className="m-0 rounded-r-[10px] border-l-[3px] border-line bg-bg px-3 py-2 text-[13px] leading-relaxed text-ink-soft">
                  “{q.quote}” <span className="text-muted">· {q.source}</span>
                </blockquote>
              ))}
              {qs.length > 2 && (
                <details className="text-[13px]">
                  <summary className="cursor-pointer font-semibold text-accent-deep">Thêm {qs.length - 2} câu nữa</summary>
                  <div className="mt-1.5 flex flex-col gap-1.5">
                    {qs.slice(2).map((q) => <blockquote key={q.code} className="m-0 rounded-r-[10px] border-l-[3px] border-line bg-bg px-3 py-2 leading-relaxed text-ink-soft">“{q.quote}” <span className="text-muted">· {q.source}</span></blockquote>)}
                  </div>
                </details>
              )}
              {p.matches && <div className="text-xs text-muted">Khớp ghi chú của bạn: {p.matches}</div>}
            </div>
          </article>
        );
      })}
    </>
  );
}

function Competitors({ body }: { body: string }) {
  const rows = competitorTable(body);
  const colors = ["#cdb8ff", "#ffd0b0", "#fff0a8", "#ff9ec4", "#9fdcc0"];
  return (
    <>
      <p className="text-[13px] leading-relaxed text-muted">Đội theo dõi những tài khoản này. Chỉ để học cách họ nói, không nêu tên họ trong bài.</p>
      {rows.map((c, i) => (
        <article key={c.name} className="flex gap-3 rounded-[18px] border border-line bg-card px-4 py-3.5">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-bold" style={{ background: colors[i % colors.length] }}>{c.name.charAt(0).toUpperCase()}</span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <h2 className="text-[15px] font-bold leading-snug">{c.name}</h2>
            {c.fields.map((f) => (
              <div key={f.label} className="text-[13px] leading-relaxed"><span className="text-muted">{f.label}: </span><span className="text-ink-soft">{tidy(f.value)}</span></div>
            ))}
          </div>
        </article>
      ))}
    </>
  );
}

// Keeps the words, drops the raw links and the "[SNIPPET]" markers researchers leave in a cell.
function tidy(s: string) {
  return s.replace(/\[SNIPPET\]/g, "").replace(/https?:\/\/\S+/g, (u) => u.replace(/^https?:\/\//, "").replace(/[?#].*$/, "")).replace(/\s{2,}/g, " ").trim();
}
