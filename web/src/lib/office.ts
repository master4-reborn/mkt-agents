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
function officeIds(): { agent: string; env: string } {
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

const SETUP = "Set up the office. Create the folders listed in your instructions under /workspace, write /workspace/README.md (one line per folder: what goes in it and who writes it), and create agents/<name>/log.md for research, writer, qa and metrics, each with a header line. Do not start research; the next message names the brand.";

// Opens a new office for a brand: a session with its own budget cap, told to set up and then to build the brand card.
export async function openOffice(sentence: string, budgetUsd: number): Promise<string> {
  const ids = officeIds();
  const s = await anthropic().beta.sessions.create({
    agent: ids.agent,
    environment_id: ids.env,
    title: sentence.slice(0, 80),
    budget: { type: "limit", max_list_cost: { amount: String(Math.round(budgetUsd * 100)), currency: "USD" } },
    initial_events: [
      { type: "user.message", content: [{ type: "text", text: SETUP }] },
      { type: "user.message", content: [{ type: "text", text: `New brand: ${sentence}` }] },
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
