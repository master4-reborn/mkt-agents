import { eq, like } from "drizzle-orm";
import { anthropic } from "./anthropic";
import { getDb, connections, brands, settings } from "./db";
import { seal, unseal, sha256, sameHash, randomToken } from "./crypto";
import { officeIds, vaultId } from "./office";

// Storages the boss connected from the Thương hiệu page. Internet is always on and needs no row here.
// Each storage is one row: the key sealed, a label to show, and whether the last call with it worked.
// The team reaches them through ONE read-only endpoint of this app (/api/mcp), declared on every office as an MCP
// server with a static bearer kept in the boss's vault; the endpoint checks the bearer against a hash kept here.

export type Kind = "notion" | "gmail" | "drive";
export const KINDS: Kind[] = ["notion", "gmail", "drive"];
export type Connection = { kind: Kind; label: string; status: "ok" | "error"; error: string | null; meta: Record<string, any>; connectedAt: Date; checkedAt: Date | null };

export async function connection(kind: Kind): Promise<Connection | null> {
  const db = await getDb();
  const [r] = await db.select().from(connections).where(eq(connections.kind, kind));
  return r ? { kind, label: r.label, status: r.status as "ok" | "error", error: r.error, meta: JSON.parse(r.meta || "{}"), connectedAt: r.connectedAt, checkedAt: r.checkedAt } : null;
}

export async function allConnections(): Promise<Connection[]> {
  const out: Connection[] = [];
  for (const k of KINDS) { const c = await connection(k); if (c) out.push(c); }
  return out;
}

// The key itself, opened on the server for one call. Null when not connected.
export async function connectionSecret(kind: Kind): Promise<string | null> {
  const db = await getDb();
  const [r] = await db.select({ secret: connections.secret }).from(connections).where(eq(connections.kind, kind));
  return r ? unseal(r.secret) : null;
}

export async function saveConnection(kind: Kind, secret: string, label: string): Promise<void> {
  const db = await getDb();
  const row = { kind, secret: seal(secret), label, status: "ok", error: null, connectedAt: new Date(), checkedAt: new Date() };
  await db.insert(connections).values(row).onConflictDoUpdate({ target: connections.kind, set: { secret: row.secret, label, status: "ok", error: null, connectedAt: row.connectedAt, checkedAt: row.checkedAt } });
}

// After a call with the key: ok clears an old error, a failure records why (the page and the home task show it).
export async function markConnection(kind: Kind, ok: boolean, error?: string): Promise<void> {
  const db = await getDb();
  await db.update(connections).set({ status: ok ? "ok" : "error", error: ok ? null : (error ?? "lỗi").slice(0, 300), checkedAt: new Date() }).where(eq(connections.kind, kind));
}

export async function updateMeta(kind: Kind, patch: (meta: Record<string, any>) => Record<string, any>): Promise<void> {
  const c = await connection(kind);
  if (!c) return;
  const db = await getDb();
  await db.update(connections).set({ meta: JSON.stringify(patch(c.meta)) }).where(eq(connections.kind, kind));
}

// Forgetting a key: the row goes, the team loses the tools at the next tools/list. Copies already saved stay where they are.
export async function disconnect(kind: Kind): Promise<void> {
  const db = await getDb();
  await db.delete(connections).where(eq(connections.kind, kind));
}

// ---- per-brand lines: what the team reads and where the app saves, for one brand

export type NotionRead = { id: string; dataSourceId: string; title: string; url: string };
export type NotionSave = { pageId: string; title: string; url: string };

export function brandNotion(b: { notionRead: string | null; notionSave: string | null }): { read: NotionRead | null; save: NotionSave | null } {
  const parse = <T,>(s: string | null): T | null => { try { return s ? (JSON.parse(s) as T) : null; } catch { return null; } };
  return { read: parse<NotionRead>(b.notionRead), save: parse<NotionSave>(b.notionSave) };
}

export async function setBrandNotion(sid: string, patch: { read?: NotionRead | null; save?: NotionSave | null }): Promise<void> {
  const db = await getDb();
  const set: Record<string, string | null> = {};
  if ("read" in patch) set.notionRead = patch.read ? JSON.stringify(patch.read) : null;
  if ("save" in patch) set.notionSave = patch.save ? JSON.stringify(patch.save) : null;
  await db.update(brands).set(set).where(eq(brands.id, sid));
}

export function brandGmail(b: { gmailLabel: string | null; gmailCopy: string | null }): { label: string | null; copy: boolean } {
  return { label: b.gmailLabel || null, copy: b.gmailCopy === "1" };
}

export async function setBrandGmail(sid: string, patch: { label?: string | null; copy?: boolean }): Promise<void> {
  const db = await getDb();
  const set: Record<string, string | null> = {};
  if ("label" in patch) set.gmailLabel = patch.label || null;
  if ("copy" in patch) set.gmailCopy = patch.copy ? "1" : null;
  await db.update(brands).set(set).where(eq(brands.id, sid));
}

export type DriveRead = { id: string; name: string; url: string };

export function brandDrive(b: { driveRead: string | null }): DriveRead | null {
  try { return b.driveRead ? (JSON.parse(b.driveRead) as DriveRead) : null; } catch { return null; }
}

export async function setBrandDrive(sid: string, read: DriveRead | null): Promise<void> {
  const db = await getDb();
  await db.update(brands).set({ driveRead: read ? JSON.stringify(read) : null }).where(eq(brands.id, sid));
}

// ---- the endpoint and its bearer

export const MCP_NAME = "nguon";

// Where the office reaches this app. Null in local dev: the office cannot call a laptop, so nothing is attached there.
export function publicUrl(): string | null {
  const u = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null);
  return u ? u.replace(/\/$/, "") : null;
}
export const mcpUrl = () => { const u = publicUrl(); return u ? `${u}/api/mcp` : null; };

type Cred = { id: string; url: string; hash: string };
const CRED_KEY = "mcp_credential";

async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const [r] = await db.select().from(settings).where(eq(settings.key, key));
  return r?.value ?? null;
}
async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
}

// The bearer the office presents to /api/mcp. Made once, kept in the vault for the office (write-only there) and as
// a hash here; remade when the app's address changes, because a static_bearer is keyed by the server URL.
async function ensureCredential(url: string): Promise<Cred | null> {
  const vault = vaultId();
  if (!vault) return null;
  const have = JSON.parse((await getSetting(CRED_KEY)) ?? "null") as Cred | null;
  if (have && have.url === url) return have;
  const token = randomToken();
  const c = await anthropic().beta.vaults.credentials.create(vault, { display_name: "Đội AI · nguồn và lưu trữ", auth: { type: "static_bearer", mcp_server_url: url, token } });
  if (have) await anthropic().beta.vaults.credentials.archive(have.id, { vault_id: vault }).catch(() => {});
  const cred = { id: c.id, url, hash: sha256(token) };
  await setSetting(CRED_KEY, JSON.stringify(cred));
  return cred;
}

export async function verifyBearer(header: string | null): Promise<boolean> {
  const m = header?.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const have = JSON.parse((await getSetting(CRED_KEY)) ?? "null") as Cred | null;
  return !!have && sameHash(sha256(m[1].trim()), have.hash);
}

// The lead's own tools (from the agent) plus the toolset of this app's endpoint, allowed without asking: every tool is read-only.
export type McpAgent = { mcp_servers: { type: "url"; name: string; url: string }[]; tools: any[] };

export async function mcpAgent(): Promise<McpAgent | null> {
  const url = mcpUrl();
  if (!url) return null;
  if ((await allConnections()).length === 0) return null;
  const cred = await ensureCredential(url);
  if (!cred) return null;
  const agent: any = await anthropic().beta.agents.retrieve(officeIds().agent);
  const own = (agent.tools ?? []).map((t: any) =>
    t.type === "agent_toolset_20260401"
      ? { type: t.type, default_config: { enabled: t.default_config?.enabled ?? true, permission_policy: t.default_config?.permission_policy ?? { type: "auto" } }, configs: (t.configs ?? []).map((c: any) => ({ name: c.name, ...(c.enabled != null ? { enabled: c.enabled } : {}), ...(c.permission_policy ? { permission_policy: c.permission_policy } : {}) })) }
      : t.type === "custom" ? t : null,
  ).filter(Boolean);
  return {
    mcp_servers: [{ type: "url", name: MCP_NAME, url }],
    tools: [...own, { type: "mcp_toolset", mcp_server_name: MCP_NAME, default_config: { enabled: true, permission_policy: { type: "always_allow" } } }],
  };
}

// Whether one office has the endpoint: ok | pending (its team was busy; the poll retries) | none | error: …
export type AttachState = "ok" | "pending" | "none" | `error: ${string}`;
export const attachState = async (sid: string): Promise<AttachState> => ((await getSetting(`${sid}:mcp`)) as AttachState | null) ?? "none";
export const markAttached = (sid: string) => setSetting(`${sid}:mcp`, "ok");

// Gives one office the endpoint. A session's tools can only change while it is idle, so a busy team is marked pending.
export async function attach(sid: string): Promise<AttachState> {
  const cfg = await mcpAgent();
  if (!cfg) return "none";
  const s = await anthropic().beta.sessions.retrieve(sid);
  if (s.status === "running") { await setSetting(`${sid}:mcp`, "pending"); return "pending"; }
  if (s.status === "terminated") return "none";
  try {
    await anthropic().beta.sessions.update(sid, { agent: cfg });
    await setSetting(`${sid}:mcp`, "ok");
    return "ok";
  } catch (e) {
    const state: AttachState = `error: ${(e instanceof Error ? e.message : String(e)).slice(0, 200)}`;
    await setSetting(`${sid}:mcp`, state);
    return state;
  }
}

// After the first key is pasted: every office gets the endpoint, now or when its team is free.
export async function attachAll(): Promise<void> {
  const db = await getDb();
  for (const b of await db.select({ id: brands.id }).from(brands)) await attach(b.id).catch(() => {});
}

// From the poll: offices marked pending or failed get another try, cheaply (one settings read when there is nothing to do).
export async function retryPending(): Promise<void> {
  const db = await getDb();
  const rows = await db.select().from(settings).where(like(settings.key, "%:mcp"));
  for (const r of rows) {
    if (r.value === "ok" || r.value === "none") continue;
    await attach(r.key.slice(0, -4)).catch(() => {});
  }
}
