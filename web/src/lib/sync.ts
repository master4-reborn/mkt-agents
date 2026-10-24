import { desc, eq, inArray, sql } from "drizzle-orm";
import { anthropic, BETAS } from "./anthropic";
import { getDb, files, messages, settings, decisions } from "./db";
import { kindOf, parseFile } from "./parse";
import { sessionId } from "./office";

// Pulls what is new from the office: files the team wrote to /mnt/session/outputs/
// and the conversation with the lead. Safe to call often; everything is keyed by id.
export async function sync(): Promise<void> {
  await Promise.all([syncFiles(), syncMessages()]);
}

async function syncFiles() {
  const db = await getDb();
  const sid = sessionId();
  const listed = await anthropic().beta.files.list({ scope_id: sid, betas: BETAS } as any);
  const ids = listed.data.map((f) => f.id);
  if (ids.length === 0) return;
  const known = new Set(
    (await db.select({ id: files.id }).from(files).where(inArray(files.id, ids))).map((r) => r.id),
  );
  for (const f of listed.data) {
    if (known.has(f.id) || !f.filename.endsWith(".md")) continue;
    const resp = await anthropic().beta.files.download(f.id);
    const content = await resp.text();
    const p = parseFile(f.filename, content);
    await db
      .insert(files)
      .values({
        id: f.id,
        name: f.filename,
        kind: kindOf(f.filename),
        week: p.week,
        status: p.status,
        title: p.title,
        content,
        createdAt: new Date(f.created_at),
      })
      .onConflictDoNothing();
  }
}

async function syncMessages() {
  const db = await getDb();
  const sid = sessionId();
  const cursorRow = await db.select().from(settings).where(eq(settings.key, "events_cursor"));
  let page: string | undefined = cursorRow[0]?.value || undefined;
  for (let guard = 0; guard < 20; guard++) {
    const res: any = await anthropic().beta.sessions.events.list(sid, { limit: 1000, ...(page ? { page } : {}) } as any);
    const rows: (typeof messages.$inferInsert)[] = [];
    for (const e of res.data as any[]) {
      if (e.type === "agent.message") {
        const text = (e.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
        if (text.trim()) rows.push({ id: e.id, role: "lead", text, createdAt: when(e) });
      } else if (e.type === "user.message") {
        const text = (e.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
        if (text.trim()) rows.push({ id: e.id, role: "boss", text, createdAt: when(e) });
      } else if (e.type === "session.status_idle") {
        rows.push({ id: e.id, role: "status", text: "idle", stopReason: e.stop_reason?.type ?? null, createdAt: when(e) });
      }
    }
    if (rows.length) await db.insert(messages).values(rows).onConflictDoNothing();
    if (page) {
      await db.insert(settings).values({ key: "events_cursor", value: page }).onConflictDoUpdate({ target: settings.key, set: { value: page } });
    }
    if (!res.next_page) break;
    page = res.next_page;
  }
}

function when(e: any): Date {
  return new Date(e.processed_at ?? e.created_at ?? Date.now());
}

// Current version of every file, newest first, with the boss's latest decision applied.
export async function currentFiles(kind?: string) {
  const db = await getDb();
  const all = await db.select().from(files).orderBy(desc(files.createdAt));
  const seen = new Set<string>();
  const latest = all.filter((f) => (kind && f.kind !== kind) || seen.has(f.name) ? false : (seen.add(f.name), true));
  const names = latest.map((f) => f.name);
  const decs = names.length
    ? await db.select().from(decisions).where(inArray(decisions.fileName, names)).orderBy(desc(decisions.createdAt))
    : [];
  return latest.map((f) => {
    const d = decs.find((x) => x.fileName === f.name);
    // Re-parse at read time so a better parser applies to files synced earlier.
    const p = parseFile(f.name, f.content);
    // A decision newer than the file version overrides its status until the lead re-delivers it.
    const status = d && d.createdAt > f.createdAt ? d.decision : p.status;
    return { ...f, status, title: p.title, week: p.week, decision: d ?? null };
  });
}

export async function fileByName(name: string) {
  return (await currentFiles()).find((f) => f.name === name) ?? null;
}

export async function conversation(limit = 40) {
  const db = await getDb();
  const rows = await db.select().from(messages).orderBy(desc(messages.createdAt)).limit(limit);
  return rows.reverse();
}

export async function lastStopReason(): Promise<string | null> {
  const db = await getDb();
  const r = await db
    .select({ stopReason: messages.stopReason })
    .from(messages)
    .where(eq(messages.role, "status"))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  return r[0]?.stopReason ?? null;
}

export { sql };
