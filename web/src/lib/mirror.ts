import { and, eq } from "drizzle-orm";
import { getDb, brands, mirrors } from "./db";
import { brandNotion, connection, connectionSecret, markConnection, updateMeta } from "./connections";
import { createDatabase, createRow, NotionError } from "./notion";
import { currentFiles } from "./sync";
import { parseFile, brandName, splitDraft, weekNo } from "./parse";
import { shortSentence } from "./brands";

// Copies of what the team delivered, saved by the app into the boss's Notion after the fact: approved posts, weekly
// reports and the brand card, one row each under the page the boss chose for the brand. The office never writes there.
// A file version is saved once (mirrors table); a failed save is retried by the next poll.

export type Dbs = { posts: { id: string; ds: string }; reports: { id: string; ds: string }; cards: { id: string; ds: string } };
const TITLES: Record<keyof Dbs, string> = { posts: "Bài đã duyệt", reports: "Báo cáo tuần", cards: "Thẻ thương hiệu" };

// The three databases under one save page, created on first use and remembered on the connection.
export async function ensureDatabases(secret: string, pageId: string): Promise<Dbs> {
  const have = ((await connection("notion"))?.meta.dbs?.[pageId] ?? {}) as Partial<Dbs>;
  if (have.posts && have.reports && have.cards) return have as Dbs;
  const dbs = { ...have } as Dbs;
  for (const k of ["posts", "reports", "cards"] as const) {
    if (dbs[k]) continue;
    const d = await createDatabase(secret, pageId, TITLES[k]);
    dbs[k] = { id: d.id, ds: d.dataSourceId };
  }
  await updateMeta("notion", (m) => ({ ...m, dbs: { ...(m.dbs ?? {}), [pageId]: dbs } }));
  return dbs;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

async function record(sid: string, fileId: string, status: "ok" | "error", externalId: string | null, url: string | null, error: string | null) {
  const db = await getDb();
  await db.insert(mirrors).values({ brand: sid, fileId, target: "notion", externalId, url, status, error }).onConflictDoUpdate({ target: [mirrors.fileId, mirrors.target], set: { brand: sid, externalId, url, status, error, createdAt: new Date() } });
}

// Everything of one brand not yet in Notion. Cheap when there is nothing new: a few local reads, no Notion call.
export async function pushMirrors(sid: string): Promise<void> {
  if (!(await connection("notion"))) return;
  const db = await getDb();
  const [b] = await db.select().from(brands).where(eq(brands.id, sid));
  if (!b) return;
  const { save } = brandNotion(b);
  if (!save) return;
  const [drafts, reports, cards] = await Promise.all([currentFiles(sid, "draft"), currentFiles(sid, "report"), currentFiles(sid, "brand")]);
  const done = new Set((await db.select({ fileId: mirrors.fileId }).from(mirrors).where(and(eq(mirrors.brand, sid), eq(mirrors.target, "notion"), eq(mirrors.status, "ok")))).map((r) => r.fileId));
  type F = (typeof drafts)[number];
  const jobs: { file: F; kind: keyof Dbs; status: string; body: string }[] = [];
  for (const f of drafts) {
    if (!["approved", "posted"].includes(f.status ?? "") || done.has(f.id)) continue;
    const { post, rest } = splitDraft(parseFile(f.name, f.content).body);
    jobs.push({ file: f, kind: "posts", status: f.status === "posted" ? "Đã đăng" : "Đã duyệt", body: rest ? `${post}\n\n---\n\n${rest}` : post });
  }
  for (const f of reports) if (!done.has(f.id)) jobs.push({ file: f, kind: "reports", status: "Báo cáo", body: parseFile(f.name, f.content).body });
  for (const f of cards.slice(0, 1)) if (f.status === "ready" && !done.has(f.id)) jobs.push({ file: f, kind: "cards", status: "Sẵn sàng", body: parseFile(f.name, f.content).body });
  if (jobs.length === 0) return;
  const secret = await connectionSecret("notion");
  if (!secret) return;
  const name = (cards[0] && brandName(cards[0].content)) || shortSentence(b.sentence);
  let dbs: Dbs;
  try {
    dbs = await ensureDatabases(secret, save.pageId);
  } catch (e) {
    await markConnection("notion", false, `Không tạo được bảng dưới trang «${save.title}»: ${msg(e)}`);
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  for (const j of jobs) {
    try {
      const r = await createRow(secret, dbs[j.kind].ds, { title: j.file.title || j.file.name, brand: name, week: j.file.week ? `Tuần ${weekNo(j.file.week)}` : "", date: today, status: j.status, file: j.file.name, body: j.body });
      await record(sid, j.file.id, "ok", r.id, r.url, null);
    } catch (e) {
      await record(sid, j.file.id, "error", null, null, msg(e));
      if (e instanceof NotionError && (e.status === 401 || e.status === 403)) { await markConnection("notion", false, "Notion từ chối khoá, dán lại khoá"); return; }
      // A database the boss deleted: forget it so the next poll makes a new one.
      if (e instanceof NotionError && e.status === 404) { await updateMeta("notion", (m) => { const d = { ...(m.dbs ?? {}) }; delete d[save.pageId]; return { ...m, dbs: d }; }); return; }
    }
  }
  await markConnection("notion", true);
}

// For the page: the last saves of one brand, newest first.
export async function recentMirrors(sid: string, limit = 5) {
  const db = await getDb();
  const rows = await db.select().from(mirrors).where(and(eq(mirrors.brand, sid), eq(mirrors.target, "notion")));
  return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
}
