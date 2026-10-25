import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { anthropic, BETAS } from "./anthropic";
import { getDb, files, messages, settings, decisions, activity, brands, memories } from "./db";
import { memoryStoreId } from "./office";
import { kindOf, parseFile } from "./parse";

// Everything here is per brand: `sid` is the brand's office session.

// Pulls what is new from one office: files the team wrote to /mnt/session/outputs/
// and the conversation with the lead. Safe to call often; everything is keyed by id.
export async function sync(sid: string): Promise<void> {
  await Promise.all([syncFiles(sid), syncMessages(sid), syncMemories(sid)]);
  const db = await getDb();
  const value = new Date().toISOString();
  await db.insert(settings).values({ key: `${sid}:synced_at`, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
}

// First visit to a brand with nothing local yet: pull everything once, inline. After that the background poll keeps it fresh.
export async function ensureSynced(sid: string): Promise<void> {
  const db = await getDb();
  const row = await db.select().from(settings).where(eq(settings.key, `${sid}:synced_at`));
  if (row.length === 0) await sync(sid);
}

async function syncFiles(sid: string) {
  const db = await getDb();
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
        brand: sid,
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

// Mirrors the brand's memory store and the boss's shared one into the memories table, so the Thương hiệu page
// shows what the team learned without an API call per view. A file the team removed disappears here too.
async function syncMemories(sid: string) {
  const db = await getDb();
  const [b] = await db.select({ store: brands.memoryStoreId }).from(brands).where(eq(brands.id, sid));
  const stores = [memoryStoreId(), b?.store].filter((x): x is string => !!x);
  for (const store of stores) {
    const seen: string[] = [];
    for await (const m of anthropic().beta.memoryStores.memories.list(store, { view: "full" })) {
      if (m.type !== "memory") continue;
      seen.push(m.id);
      const row = { id: m.id, store, path: m.path, content: m.content ?? "", sha256: m.content_sha256, updatedAt: new Date(m.updated_at) };
      await db.insert(memories).values(row).onConflictDoUpdate({ target: memories.id, set: { path: row.path, content: row.content, sha256: row.sha256, updatedAt: row.updatedAt } });
    }
    await db.delete(memories).where(seen.length ? and(eq(memories.store, store), notInArray(memories.id, seen)) : eq(memories.store, store));
  }
}

const EMPLOYEE = (agentName: string | undefined) => (agentName ?? "").replace(/^marketing-/, "") || "lead";

async function syncMessages(sid: string) {
  const db = await getDb();
  const CURSOR_KEY = `${sid}:events_cursor_v2`;
  const THREADS_KEY = `${sid}:threads`;
  const cursorRow = await db.select().from(settings).where(eq(settings.key, CURSOR_KEY));
  let page: string | undefined = cursorRow[0]?.value || undefined;
  const threadRow = await db.select().from(settings).where(eq(settings.key, THREADS_KEY));
  const threads: Record<string, string> = threadRow[0] ? JSON.parse(threadRow[0].value) : {};
  for (let guard = 0; guard < 20; guard++) {
    const res: any = await anthropic().beta.sessions.events.list(sid, { limit: 1000, ...(page ? { page } : {}) } as any);
    const rows: (typeof messages.$inferInsert)[] = [];
    const acts: (typeof activity.$inferInsert)[] = [];
    for (const e of res.data as any[]) {
      if (e.type === "session.thread_created") {
        threads[e.session_thread_id] = e.agent_name;
      } else if (e.type === "session.thread_status_running" || e.type === "session.thread_status_idle") {
        acts.push({ id: e.id, brand: sid, agent: EMPLOYEE(e.agent_name ?? threads[e.session_thread_id]), kind: e.type.endsWith("running") ? "running" : "idle", text: e.stop_reason?.type ?? "", createdAt: when(e) });
      } else if (e.type === "agent.thread_message_sent") {
        acts.push({ id: e.id, brand: sid, agent: EMPLOYEE(e.to_agent_name ?? threads[e.to_session_thread_id]), kind: "task", text: textOf(e.content), createdAt: when(e) });
      } else if (e.type === "agent.thread_message_received") {
        acts.push({ id: e.id, brand: sid, agent: EMPLOYEE(e.from_agent_name ?? threads[e.from_session_thread_id]), kind: "report", text: textOf(e.content), createdAt: when(e) });
      } else if (e.type === "agent.message") {
        const text = (e.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
        if (text.trim()) rows.push({ id: e.id, brand: sid, role: "lead", text, createdAt: when(e) });
      } else if (e.type === "user.message") {
        const text = (e.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
        if (text.trim()) rows.push({ id: e.id, brand: sid, role: "boss", text, createdAt: when(e) });
      } else if (e.type === "session.status_idle") {
        rows.push({ id: e.id, brand: sid, role: "status", text: "idle", stopReason: e.stop_reason?.type ?? null, createdAt: when(e) });
      }
    }
    if (rows.length) await db.insert(messages).values(rows).onConflictDoNothing();
    if (acts.length) await db.insert(activity).values(acts).onConflictDoNothing();
    if (page) {
      await db.insert(settings).values({ key: CURSOR_KEY, value: page }).onConflictDoUpdate({ target: settings.key, set: { value: page } });
    }
    if (!res.next_page) break;
    page = res.next_page;
  }
  const tj = JSON.stringify(threads);
  await db.insert(settings).values({ key: THREADS_KEY, value: tj }).onConflictDoUpdate({ target: settings.key, set: { value: tj } });
}

function textOf(content: any): string {
  if (typeof content === "string") return content;
  return (content ?? []).filter((b: any) => b.type === "text" || b.text).map((b: any) => b.text).join("");
}

export const TEAM = ["lead", "research", "writer", "qa", "metrics"] as const;
export type Employee = (typeof TEAM)[number];
export type EmployeeState = {
  agent: Employee;
  state: "working" | "done" | "waiting"; // working now | has delivered before | never worked
  task: string | null; // the last task the lead gave (lead: the boss's last order)
  report: string | null; // the last thing it reported (lead: its last message to the boss)
  since: Date | null;
};

export async function teamState(sid: string): Promise<EmployeeState[]> {
  const db = await getDb();
  const acts = await db.select().from(activity).where(eq(activity.brand, sid)).orderBy(desc(activity.createdAt)).limit(600);
  const msgs = await db.select().from(messages).where(eq(messages.brand, sid)).orderBy(desc(messages.createdAt)).limit(40);
  return TEAM.map((agent) => {
    const mine = acts.filter((a) => a.agent === agent);
    const status = mine.find((a) => a.kind === "running" || a.kind === "idle");
    const task = agent === "lead" ? msgs.find((m) => m.role === "boss") : mine.find((a) => a.kind === "task");
    const report = agent === "lead" ? msgs.find((m) => m.role === "lead") : mine.find((a) => a.kind === "report");
    const working = status?.kind === "running";
    return {
      agent,
      state: working ? "working" : report ? "done" : "waiting",
      task: task?.text ?? null,
      report: report?.text ?? null,
      since: status?.createdAt ?? null,
    };
  });
}

function when(e: any): Date {
  return new Date(e.processed_at ?? e.created_at ?? Date.now());
}

// Current version of every file of one brand, newest first, with the boss's latest decision applied.
export async function currentFiles(sid: string, kind?: string) {
  const db = await getDb();
  const all = await db.select().from(files).where(eq(files.brand, sid)).orderBy(desc(files.createdAt));
  const seen = new Set<string>();
  const latest = all.filter((f) => (kind && f.kind !== kind) || seen.has(f.name) ? false : (seen.add(f.name), true));
  const names = latest.map((f) => f.name);
  const decs = names.length
    ? await db.select().from(decisions).where(and(eq(decisions.brand, sid), inArray(decisions.fileName, names))).orderBy(desc(decisions.createdAt))
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

// The current files of one memory store, as last mirrored.
export async function memoryFiles(store: string) {
  const db = await getDb();
  return db.select().from(memories).where(eq(memories.store, store)).orderBy(memories.path);
}

export async function fileByName(sid: string, name: string) {
  return (await currentFiles(sid)).find((f) => f.name === name) ?? null;
}

export async function conversation(sid: string, limit = 40) {
  const db = await getDb();
  const rows = await db.select().from(messages).where(eq(messages.brand, sid)).orderBy(desc(messages.createdAt)).limit(limit);
  return rows.reverse();
}

export async function lastStopReason(sid: string): Promise<string | null> {
  const db = await getDb();
  const r = await db
    .select({ stopReason: messages.stopReason })
    .from(messages)
    .where(and(eq(messages.brand, sid), eq(messages.role, "status")))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  return r[0]?.stopReason ?? null;
}

export { sql };
