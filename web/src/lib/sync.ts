import { desc, eq, inArray, sql } from "drizzle-orm";
import { anthropic, BETAS } from "./anthropic";
import { getDb, files, messages, settings, decisions, activity } from "./db";
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

const CURSOR_KEY = "events_cursor_v2";
const EMPLOYEE = (agentName: string | undefined) => (agentName ?? "").replace(/^marketing-/, "") || "lead";

async function syncMessages() {
  const db = await getDb();
  const sid = sessionId();
  const cursorRow = await db.select().from(settings).where(eq(settings.key, CURSOR_KEY));
  let page: string | undefined = cursorRow[0]?.value || undefined;
  const threadRow = await db.select().from(settings).where(eq(settings.key, "threads"));
  const threads: Record<string, string> = threadRow[0] ? JSON.parse(threadRow[0].value) : {};
  for (let guard = 0; guard < 20; guard++) {
    const res: any = await anthropic().beta.sessions.events.list(sid, { limit: 1000, ...(page ? { page } : {}) } as any);
    const rows: (typeof messages.$inferInsert)[] = [];
    const acts: (typeof activity.$inferInsert)[] = [];
    for (const e of res.data as any[]) {
      if (e.type === "session.thread_created") {
        threads[e.session_thread_id] = e.agent_name;
      } else if (e.type === "session.thread_status_running" || e.type === "session.thread_status_idle") {
        acts.push({ id: e.id, agent: EMPLOYEE(e.agent_name ?? threads[e.session_thread_id]), kind: e.type.endsWith("running") ? "running" : "idle", text: e.stop_reason?.type ?? "", createdAt: when(e) });
      } else if (e.type === "agent.thread_message_sent") {
        acts.push({ id: e.id, agent: EMPLOYEE(e.to_agent_name ?? threads[e.to_session_thread_id]), kind: "task", text: textOf(e.content), createdAt: when(e) });
      } else if (e.type === "agent.thread_message_received") {
        acts.push({ id: e.id, agent: EMPLOYEE(e.from_agent_name ?? threads[e.from_session_thread_id]), kind: "report", text: textOf(e.content), createdAt: when(e) });
      } else if (e.type === "agent.message") {
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
    if (acts.length) await db.insert(activity).values(acts).onConflictDoNothing();
    if (page) {
      await db.insert(settings).values({ key: CURSOR_KEY, value: page }).onConflictDoUpdate({ target: settings.key, set: { value: page } });
    }
    if (!res.next_page) break;
    page = res.next_page;
  }
  const tj = JSON.stringify(threads);
  await db.insert(settings).values({ key: "threads", value: tj }).onConflictDoUpdate({ target: settings.key, set: { value: tj } });
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

export async function teamState(): Promise<EmployeeState[]> {
  const db = await getDb();
  const acts = await db.select().from(activity).orderBy(desc(activity.createdAt)).limit(600);
  const msgs = await db.select().from(messages).orderBy(desc(messages.createdAt)).limit(40);
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
