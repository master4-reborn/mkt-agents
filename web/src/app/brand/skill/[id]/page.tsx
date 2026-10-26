import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireBrand } from "@/lib/brands";
import { md, weekNo } from "@/lib/parse";
import { EMPLOYEES, EMPLOYEE_LABEL, compareRules, mergedContent, pendingProposals, reviewDoc, rulesText, scopeLabel, scopeSkills, similarTo, skillDoc, skillUses, countUses, versionWithSkill, SHARED, type Rule, type Source, type Use, type VersionRow } from "@/lib/skills";
import { getDb, scoutRuns } from "@/lib/db";
import { SubmitButton } from "@/components/SubmitButton";
import { IconBack, IconChevron, IconExternal } from "@/components/Icons";
import { restoreSkill, toggleSkill } from "../../../actions";
import { Review, type Chip } from "./Review";

export const dynamic = "force-dynamic";

const day = (d: Date) => d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

const STATUS: Record<string, [string, string]> = {
  proposed: ["Chờ duyệt", "chip-accent"],
  current: ["Đang dùng", "chip-ok"],
  superseded: ["Bản cũ", "chip-outline"],
  rejected: ["Đã bỏ", "chip-outline"],
};

const POST_STATUS: Record<string, [string, string]> = {
  ready: ["Chờ duyệt", "chip-accent"],
  approved: ["Đã duyệt", "chip-ok"],
  posted: ["Đã đăng", "chip-ok"],
  rejected: ["Trả lại", "chip-bad"],
};

// Two sources, or one official platform source, back a rule (agents/scout.md); one other source is flagged yellow.
function sourceChip(rule: Rule, sources: Source[]): Chip {
  const n = rule.sources.length;
  if (n === 0) return null;
  if (n === 1 && /chính thức/i.test(sources[rule.sources[0] - 1]?.kind ?? "")) return { label: "chính thức", cls: "chip-ok" };
  return { label: `${n} nguồn`, cls: n === 1 ? "chip-warn" : "chip-outline" };
}

// One version of a skill: a proposal to approve, edit or turn down, or a version in use with what the team wrote with it
// and its history. The boss reads every rule with its sources here before anything reaches the team.
export default async function SkillVersion({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireBrand();
  const row = await versionWithSkill(Number((await params).id));
  if (!row || (row.s.scope !== SHARED && row.s.scope !== me.id)) notFound();
  const { v, s, history } = row;
  const doc = skillDoc(v.content);
  const rv = reviewDoc(v.review);
  const db = await getDb();
  const [run] = v.run ? await db.select().from(scoutRuns).where(eq(scoutRuns.id, v.run)) : [];
  const [scope, brandLabel, inScope, uses] = await Promise.all([scopeLabel(s.scope), scopeLabel(me.id), scopeSkills(s.scope), skillUses(me.id)]);
  const proposed = v.status === "proposed";
  const retired = s.status === "retired";
  const receivers = s.receivers.split(",");
  const [label, chip] = retired && v.status === "current" ? ["Ngừng dùng", "chip-outline"] : STATUS[v.status] ?? [v.status, "chip-outline"];
  const moved = proposed && rv.kind === "update" && (v.base ?? 0) !== (s.current ?? 0);
  const back = s.scope === SHARED ? "/brand#ky-nang-chung" : "/brand#ky-nang-rieng";
  const like = similarTo(v, s, inScope);
  const mine = uses.get(s.slug) ?? [];
  // Proposals elsewhere in this scope that look like this skill, for its history.
  const lookalikes = proposed ? [] : (await pendingProposals([s.scope])).filter((p) => similarTo(p.v, p.s, inScope)?.id === s.id);
  const fold = !proposed;

  const full = (
    <>
      {rv.why && (fold ? (
        <Fold title="Vì sao trinh sát đề xuất"><p className="row whitespace-pre-line text-sm leading-relaxed">{md(rv.why)}</p></Fold>
      ) : (
        <section className="card flex flex-col gap-1.5">
          <div className="eyebrow">Vì sao bây giờ</div>
          <p className="whitespace-pre-line text-sm leading-relaxed">{md(rv.why)}</p>
          {run?.costCents != null && <div className="text-xs text-muted">Lần tìm này tốn {(run.costCents / 100).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} USD.</div>}
        </section>
      ))}

      {proposed && run?.verdict && (run.verdict === "satisfied"
        ? <div className="rounded-2xl bg-ok-soft px-4 py-3 text-[13px] text-ok-deep">Bộ chấm độc lập cho qua: đủ nguồn, quy tắc chấm được đúng sai, không trái nội quy.</div>
        : <div className="rounded-2xl bg-warn-soft px-4 py-3 text-[13px] text-warn">Bộ chấm độc lập chưa cho qua hết sau 3 vòng. Xem Cảnh báo và nguồn của từng quy tắc; quy tắc chỉ có 1 nguồn không chính thức được tô vàng. Sửa quy tắc rồi duyệt, hoặc bỏ kèm lý do.</div>)}

      {moved && <div className="rounded-2xl bg-warn-soft px-4 py-3 text-[13px] text-warn">Kỹ năng đã sang bản {s.current} từ khi trinh sát viết đề xuất này (dựa trên bản {v.base}). Đọc kỹ phần thay đổi, hoặc bỏ đề xuất và tìm lại.</div>}

      {rv.warnings.length > 0 && (fold ? (
        <Fold title={`Cảnh báo lúc duyệt · ${rv.warnings.length}`}>{rv.warnings.map((w, i) => <div key={i} className="row text-[13px] leading-relaxed text-bad">{md(w)}</div>)}</Fold>
      ) : (
        <section className="flex flex-col gap-1.5 rounded-2xl border border-bad bg-bad-soft px-4 py-3">
          <div className="text-[13px] font-bold text-bad">Cảnh báo</div>
          {rv.warnings.map((w, i) => <div key={i} className="text-[13px] leading-relaxed text-bad">{md(w)}</div>)}
        </section>
      ))}

      {rv.changes.length > 0 && <List title={`Thay đổi so với bản ${v.base ?? s.current}`} items={rv.changes} fold={fold} />}

      <Block title={`Quy tắc · ${doc.rules.length}`} fold={fold}>
        {doc.rules.map((r, i) => {
          const c = sourceChip(r, doc.sources);
          return (
            <div key={i} className="row items-start">
              <span className="w-5 flex-none text-sm font-bold text-accent-deep">{i + 1}</span>
              <span className="min-w-0 flex-1 text-sm leading-relaxed">{md(r.text)}</span>
              {c && <span className={`chip flex-none ${c.cls}`}>{c.label}</span>}
            </div>
          );
        })}
      </Block>

      {doc.good.length > 0 && <List title={fold ? `Ví dụ tốt · ${doc.good.length}` : "Ví dụ tốt"} items={doc.good} fold={fold} />}
      {doc.bad.length > 0 && <List title={`Ví dụ dở · ${doc.bad.length}`} items={doc.bad} fold />}
      {doc.steps.length > 0 && <List title={`Các bước · ${doc.steps.length}`} items={doc.steps} numbered fold />}
      {doc.qa.length > 0 && <List title={`QA kiểm thế nào · ${doc.qa.length}`} items={doc.qa} fold />}

      {doc.sources.length > 0 && (
        <Block title={`Nguồn · ${doc.sources.length}`} fold={fold}>
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
        </Block>
      )}
    </>
  );

  // "Làm bản N của X": what the proposal adds to X, what X has that it lacks, what both say.
  let merge = null;
  if (like) {
    const cur = like.versions.find((x) => x.version === like.current)!;
    const old = skillDoc(cur.content);
    const cmp = compareRules(doc.rules, old.rules);
    merge = {
      id: like.id,
      title: like.title,
      version: like.current!,
      next: Math.max(...like.versions.map((x) => x.version ?? 0)) + 1,
      href: `/brand/skill/${cur.id}`,
      posts: countUses(uses.get(like.slug) ?? []).posts,
      receivers: like.receivers.split(","),
      added: cmp.added.map((i) => ({ text: md(doc.rules[i].text), chip: sourceChip(doc.rules[i], doc.sources) })),
      dropped: cmp.dropped.map((j) => ({ j, text: md(old.rules[j].text) })),
      same: cmp.same.map(([i]) => md(doc.rules[i].text)),
      rules: rulesText(mergedContent(v.content, cur.content, like, cmp.dropped)),
    };
  }

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
          {like ? <span className="chip chip-warn">Trùng chủ đề</span> : <span className="chip chip-accent">{proposed ? (s.current ? `Cập nhật · bản ${s.current + 1}` : "Mới") : v.reason?.startsWith("Dùng lại") ? v.reason : `Bản ${v.version ?? "?"}`}</span>}
          {!proposed && receivers.map((r) => <span key={r} className="chip chip-outline">{EMPLOYEE_LABEL[r] ?? r}</span>)}
          {v.edited && <span className="chip chip-warn">Bạn đã sửa</span>}
        </div>
        {doc.when && <p className="text-[13px] leading-relaxed text-muted">{md(doc.when)}</p>}
      </section>

      {merge && (
        <section className="flex flex-col gap-1.5 rounded-2xl border border-warn-line bg-warn-soft px-4 py-3.5">
          <div className="text-sm font-bold text-warn">Giống một kỹ năng đang dùng</div>
          <div className="text-[13px] leading-relaxed text-warn">
            Đề xuất này cùng chủ đề với <Link href={merge.href} className="font-bold text-warn underline">{merge.title}</Link> (bản {merge.version}{merge.posts ? `, đã dùng cho ${merge.posts} bài` : ""}). Hai kỹ năng cùng chủ đề dễ bảo đội hai điều khác nhau.
          </div>
        </section>
      )}

      {!proposed && (receivers.includes("writer") || mine.length > 0) && <Used uses={mine} brand={brandLabel} />}

      {proposed ? (
        <Review
          id={v.id}
          receivers={rv.receivers.length ? rv.receivers : receivers}
          employees={EMPLOYEES.map((e) => [e, EMPLOYEE_LABEL[e]])}
          rules={rulesText(v.content)}
          merge={merge}
          summary={`${doc.rules.length} quy tắc, ví dụ, ${doc.sources.length} nguồn`}
        >
          {full}
        </Review>
      ) : full}

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

      {(history.length > 1 || lookalikes.length > 0) && (
        <section className="overflow-hidden rounded-[18px] border border-line bg-card">
          <div className="px-4 pb-1.5 pt-3 text-xs font-bold uppercase tracking-wider text-muted">Lịch sử</div>
          {lookalikes.map((p) => (
            <Link key={p.v.id} href={`/brand/skill/${p.v.id}`} className="row text-ink">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold">Đề xuất trùng chủ đề</span>
                <span className="truncate text-xs text-muted">{day(p.v.createdAt)} · {reviewDoc(p.v.review).title || p.s.title}</span>
              </span>
              <span className="chip chip-accent">Chờ duyệt</span>
            </Link>
          ))}
          {history.length > 1 && history.map((h) => <HistoryRow key={h.id} h={h} here={h.id === v.id} retired={retired} posts={h.version == null ? 0 : mine.filter((u) => u.kind === "draft" && u.version === h.version).length} />)}
        </section>
      )}
    </div>
  );
}

// What the team wrote with this skill for the brand on screen, from the skill tags on drafts and replies, and what the boss
// decided on them. Engagement per skill needs weeks of numbers and is not shown yet.
function Used({ uses, brand }: { uses: Use[]; brand: string }) {
  const c = countUses(uses);
  const posts = uses.filter((u) => u.kind === "draft");
  const unit = c.posts ? "bài" : "câu trả lời";
  const counted = c.posts ? posts : uses;
  const versions = [...new Set(counted.map((u) => u.version))].sort((a, b) => (b ?? 0) - (a ?? 0));
  const first = counted.map((u) => u.week).filter(Boolean).sort()[0];
  // "Bản 2: 4 bài · bản 1: 2 bài · 3 câu trả lời"
  const split = [
    ...(versions.length > 1 ? versions.map((n) => `${n ? `bản ${n}` : "không ghi bản"}: ${counted.filter((u) => u.version === n).length} ${unit}`) : []),
    ...(c.posts && c.replies ? [`${c.replies} câu trả lời`] : []),
  ].join(" · ");
  return (
    <section className="overflow-hidden rounded-[18px] border border-line bg-card">
      <div className="flex flex-col gap-1 px-4 pb-3 pt-4">
        <div className="eyebrow">Đã dùng</div>
        {uses.length ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[30px] font-bold leading-none">{counted.length} {unit}</span>
              <span className="text-[13px] text-muted">ở {brand}{first ? ` từ tuần ${weekNo(first)}` : ""}</span>
            </div>
            {split && <div className="text-xs text-muted">{split.charAt(0).toUpperCase() + split.slice(1)}</div>}
          </>
        ) : (
          <div className="text-sm text-muted">Chưa có bài nào dùng kỹ năng này.</div>
        )}
      </div>
      {uses.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-1.5 px-4 pb-3.5">
            <Tile n={c.approved} label="bạn duyệt" cls="bg-ok-soft text-ok-deep" />
            <Tile n={c.returned} label="trả lại" cls="bg-bad-soft text-bad" />
            <Tile n={c.waiting} label="đang chờ" cls="bg-accent-soft text-accent-deep" />
          </div>
          {posts.slice(0, 3).map((u) => <PostLine key={u.name} u={u} />)}
          {posts.length > 3 && (
            <details className="group border-t border-line-soft">
              <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-semibold text-accent-deep group-open:hidden [&::-webkit-details-marker]:hidden">Xem cả {posts.length} bài</summary>
              {posts.slice(3).map((u) => <PostLine key={u.name} u={u} />)}
            </details>
          )}
          <div className="row text-xs leading-relaxed text-muted">Chưa đo lượt lưu, lượt trả lời theo kỹ năng: cần đủ 4 tuần số liệu.</div>
        </>
      )}
    </section>
  );
}

function Tile({ n, label, cls }: { n: number; label: string; cls: string }) {
  return (
    <div className={`flex flex-col gap-0.5 rounded-xl px-3 py-2.5 ${cls}`}>
      <span className="text-lg font-bold leading-tight">{n}</span>
      <span className="text-xs font-semibold">{label}</span>
    </div>
  );
}

function PostLine({ u }: { u: Use }) {
  const [label, cls] = POST_STATUS[u.status ?? ""] ?? ["Đang sửa", "chip-outline"];
  return (
    <Link href={`/drafts/${encodeURIComponent(u.name)}`} className="row text-ink">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold">{u.title}</span>
        <span className="text-xs text-muted">{[u.version && `bản ${u.version}`, u.week && `tuần ${weekNo(u.week)}`].filter(Boolean).join(" · ")}</span>
      </span>
      <span className={`chip ${cls}`}>{label}</span>
    </Link>
  );
}

// A section shown open with its heading, or folded to one tappable line.
function Block({ title, fold = false, children }: { title: string; fold?: boolean; children: React.ReactNode }) {
  if (fold) return <Fold title={title}>{children}</Fold>;
  return (
    <section className="overflow-hidden rounded-[18px] border border-line bg-card">
      <div className="px-4 pb-1.5 pt-3 text-xs font-bold uppercase tracking-wider text-muted">{title}</div>
      {children}
    </section>
  );
}

function Fold({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group overflow-hidden rounded-[18px] border border-line bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
        {title}
        <IconChevron className="flex-none rotate-90 text-faint transition-transform group-open:-rotate-90" />
      </summary>
      {children}
    </details>
  );
}

function List({ title, items, numbered = false, fold = false }: { title: string; items: string[]; numbered?: boolean; fold?: boolean }) {
  return (
    <Block title={title} fold={fold}>
      {items.map((t, i) => (
        <div key={i} className="row items-start">
          {numbered && <span className="w-5 flex-none text-sm font-bold text-muted">{i + 1}</span>}
          <span className="min-w-0 flex-1 text-sm leading-relaxed">{md(t)}</span>
        </div>
      ))}
    </Block>
  );
}

function HistoryRow({ h, here, retired, posts }: { h: VersionRow; here: boolean; retired: boolean; posts: number }) {
  const [label, chip] = retired && h.status === "current" ? ["Ngừng dùng", "chip-outline"] : STATUS[h.status] ?? [h.status, "chip-outline"];
  const inner = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-semibold">{h.version ? `Bản ${h.version}` : "Đề xuất"}{here ? " · đang xem" : ""}</span>
        <span className="truncate text-xs text-muted">{day(h.decidedAt ?? h.createdAt)}{h.reason ? ` · ${h.reason}` : ""}{h.edited ? " · bạn đã sửa" : ""}{posts ? ` · ${posts} bài` : ""}</span>
      </span>
      <span className={`chip ${chip}`}>{label}</span>
    </>
  );
  return here ? <div className="row bg-accent-soft/40">{inner}</div> : <Link href={`/brand/skill/${h.id}`} className="row text-ink">{inner}</Link>;
}
