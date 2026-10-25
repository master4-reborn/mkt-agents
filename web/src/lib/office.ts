import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { anthropic } from "./anthropic";
import { getDb, settings } from "./db";

// Each brand is one long-lived Managed Agents session with the same team; `sid` is that session's id.

// The single session the app used before brands existed. Registered as the first brand on upgrade.
export function legacySessionId(): string | null {
  if (process.env.OFFICE_SESSION_ID) return process.env.OFFICE_SESSION_ID;
  const f = path.resolve(process.cwd(), "../.office/session_id");
  return fs.existsSync(f) ? fs.readFileSync(f, "utf8").trim() : null;
}

export function consoleUrl(sid: string): string {
  const ws = process.env.ANTHROPIC_WORKSPACE_ID ?? "default";
  return `https://platform.claude.com/workspaces/${ws}/sessions/${sid}`;
}

// The lead agent and the cloud environment, from the env or from `ant apply`'s lock file next to the repo.
export function officeIds(): { agent: string; env: string } {
  let agent = process.env.OFFICE_AGENT_ID;
  let env = process.env.OFFICE_ENV_ID;
  if (!agent || !env) {
    const f = path.resolve(process.cwd(), "../claude-lock.json");
    if (!fs.existsSync(f)) throw new Error("Set OFFICE_AGENT_ID and OFFICE_ENV_ID (or run `ant apply agents environments` in the repo root).");
    const lock = JSON.parse(fs.readFileSync(f, "utf8"));
    agent ||= lock.resources["./agents/lead.md"].id;
    env ||= lock.resources["./environments/cloud.yaml"].id;
  }
  return { agent: agent!, env: env! };
}

// The boss's shared memory store, from the env or the lock file (declared as memory_stores/sep.yaml). Null until it is applied:
// an office opened without it simply has no memory.
export function memoryStoreId(): string | null {
  if (process.env.OFFICE_MEMORY_ID) return process.env.OFFICE_MEMORY_ID;
  const f = path.resolve(process.cwd(), "../claude-lock.json");
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, "utf8")).resources["./memory_stores/sep.yaml"]?.id ?? null;
}

// The boss's credential vault (declared as vaults/sep.yaml), attached to every office when it opens because
// vault_ids is create-only. Empty until a connection (Notion, Gmail, Drive) is added; an empty vault costs nothing.
export function vaultId(): string | null {
  if (process.env.OFFICE_VAULT_ID) return process.env.OFFICE_VAULT_ID;
  const f = path.resolve(process.cwd(), "../claude-lock.json");
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, "utf8")).resources["./vaults/sep.yaml"]?.id ?? null;
}

// The Monday order, in Vietnamese so the lead answers in Vietnamese. `auto` marks a run the schedule started.
export function weekOrder(week: string, note: string, auto = false): string {
  return `Chạy tuần ${week}.\n\n${auto ? "(Lệnh tự động theo lịch sáng thứ Hai.)\n\n" : ""}Làm theo chu trình tuần: nghiên cứu, rồi viết 3 đến 5 bài, rồi QA, rồi chép các file của tuần vào /mnt/session/outputs/${week}/ và báo cáo.\n\nGhi chú của sếp cho tuần này: ${note || "không có"}`;
}

const SEP_INSTRUCTIONS = "Bộ nhớ chung của sếp, dùng cho mọi thương hiệu: quyet-dinh.md, threads.md, tu-cam.md. Đọc trước mỗi chu trình; chỉ trưởng nhóm ghi, theo đúng mục Bộ nhớ trong hướng dẫn.";
const BRAND_INSTRUCTIONS = "Bộ nhớ riêng của thương hiệu này: bai-hoc.md, bai-tot.md, khach-hoi.md. Đọc trước mỗi chu trình; chỉ trưởng nhóm ghi, theo đúng mục Bộ nhớ trong hướng dẫn.";

// brand-<slug>: ASCII from the boss's sentence (Vietnamese letters lose their marks) plus a short stamp,
// so two brands never share a mount path under /mnt/memory/.
export function brandSlug(sentence: string): string {
  const ascii = sentence.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${ascii.slice(0, 24).replace(/-+$/, "") || "brand"}-${Date.now().toString(36).slice(-4)}`;
}

export type Office = { id: string; memoryStoreId: string | null; slug: string | null };

async function createBrandStore(sentence: string): Promise<{ id: string; slug: string }> {
  const slug = brandSlug(sentence);
  const store = await anthropic().beta.memoryStores.create({
    name: `brand-${slug}`,
    description: `Memory of one brand (${sentence.slice(0, 200)}): bai-hoc.md (corrections from the boss, one per line), bai-tot.md (posts that scored, with the number), khach-hoi.md (recurring customer questions with the approved reply). Only the lead writes it.`,
  });
  return { id: store.id, slug };
}

function memoryResources(sep: string, brandStore: string) {
  return [
    { type: "memory_store" as const, memory_store_id: sep, access: "read_write" as const, instructions: SEP_INSTRUCTIONS },
    { type: "memory_store" as const, memory_store_id: brandStore, access: "read_write" as const, instructions: BRAND_INSTRUCTIONS },
  ];
}

const SETUP = "Set up the office. Create the folders listed in your instructions under /workspace, write /workspace/README.md (one line per folder: what goes in it and who writes it), and create agents/<name>/log.md for research, writer, qa and metrics, each with a header line. Do not start research; the next message names the brand.";

// Opens a new office for a brand: a session with its own budget cap and the two memory stores (the boss's shared one
// and a new one for this brand), told to set up and then to build the brand card. Stores attach at creation only.
export async function openOffice(sentence: string, budgetUsd: number, overrides: AgentOverrides = null): Promise<Office> {
  const sep = memoryStoreId();
  const store = sep ? await createBrandStore(sentence) : null;
  const id = await createSession(sentence, budgetUsd, sep && store ? memoryResources(sep, store.id) : [], `New brand: ${sentence}`, overrides);
  return { id, memoryStoreId: store?.id ?? null, slug: store?.slug ?? null };
}

// A stopped office (budget reached or terminated) gets a new session on the same memory stores, so nothing learned
// is lost. The current card travels in the first message; a brand from before memory existed gets its store now.
export async function reopenOffice(brand: { sentence: string; memoryStoreId: string | null; slug: string | null }, budgetUsd: number, card: string | null, overrides: AgentOverrides = null): Promise<Office> {
  const sep = memoryStoreId();
  const store = sep ? brand.memoryStoreId ? { id: brand.memoryStoreId, slug: brand.slug } : await createBrandStore(brand.sentence) : null;
  const text = card
    ? `Mở lại văn phòng cho thương hiệu đã có. Thẻ thương hiệu hiện tại ở dưới: ghi nguyên văn vào brand/BRAND.md, chép vào /mnt/session/outputs/BRAND.md, đọc bộ nhớ rồi báo cáo. Không chạy tuần mới.\n\n${card}`
    : `New brand: ${brand.sentence}`;
  const id = await createSession(brand.sentence, budgetUsd, sep && store ? memoryResources(sep, store.id) : [], text, overrides);
  return { id, memoryStoreId: store?.id ?? null, slug: store?.slug ?? null };
}

// The app's own MCP endpoint and the lead's tools (lib/connections.ts, mcpAgent), when a storage is connected: an office
// born with them needs no later update.
export type AgentOverrides = { mcp_servers: { type: "url"; name: string; url: string }[]; tools: any[] } | null;

async function createSession(sentence: string, budgetUsd: number, resources: ReturnType<typeof memoryResources> | [], second: string, overrides: AgentOverrides): Promise<string> {
  const ids = officeIds();
  const vault = vaultId();
  const s = await anthropic().beta.sessions.create({
    agent: overrides ? { type: "agent_with_overrides", id: ids.agent, ...overrides } : ids.agent,
    environment_id: ids.env,
    title: sentence.slice(0, 80),
    budget: { type: "limit", max_list_cost: { amount: String(Math.round(budgetUsd * 100)), currency: "USD" } },
    ...(resources.length ? { resources } : {}),
    ...(vault ? { vault_ids: [vault] } : {}),
    initial_events: [
      { type: "user.message", content: [{ type: "text", text: SETUP }] },
      { type: "user.message", content: [{ type: "text", text: second }] },
    ],
  });
  return s.id;
}

export type OfficeStatus = {
  status: string; // running | idle | ...
  listCostUsd: number;
  budgetUsd: number | null;
};

const statusKey = (sid: string) => `${sid}:office_status`;

// Live status from the API, remembered locally so pages can render without waiting for it.
export async function officeStatus(sid: string): Promise<OfficeStatus> {
  const s = await anthropic().beta.sessions.retrieve(sid);
  const usage = (s as any).usage ?? {};
  const budget = (s as any).budget?.max_list_cost?.amount;
  const out: OfficeStatus = {
    status: s.status,
    listCostUsd: Number(usage.list_cost?.amount ?? 0) / 100,
    budgetUsd: budget ? Number(budget) / 100 : null,
  };
  const db = await getDb();
  const value = JSON.stringify(out);
  await db.insert(settings).values({ key: statusKey(sid), value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  return out;
}

// The status we saw last, or null when this office has never been asked.
export async function cachedStatus(sid: string): Promise<OfficeStatus | null> {
  const db = await getDb();
  const row = await db.select().from(settings).where(eq(settings.key, statusKey(sid)));
  return row[0] ? (JSON.parse(row[0].value) as OfficeStatus) : null;
}

// The background poll keeps the cache fresh; a live call only when nothing is remembered yet.
export async function knownStatus(sid: string): Promise<OfficeStatus> {
  return (await cachedStatus(sid)) ?? officeStatus(sid);
}

export async function say(sid: string, text: string): Promise<void> {
  await anthropic().beta.sessions.events.send(sid, {
    events: [{ type: "user.message", content: [{ type: "text", text }] }],
  });
}

export function weekLabel(d = new Date()): string {
  // ISO week, e.g. 2026-W43
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
