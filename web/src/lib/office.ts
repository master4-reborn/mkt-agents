import fs from "node:fs";
import path from "node:path";
import { anthropic } from "./anthropic";

// The office = one long-lived Managed Agents session.
export function sessionId(): string {
  if (process.env.OFFICE_SESSION_ID) return process.env.OFFICE_SESSION_ID;
  const f = path.resolve(process.cwd(), "../.office/session_id");
  if (fs.existsSync(f)) return fs.readFileSync(f, "utf8").trim();
  throw new Error("Set OFFICE_SESSION_ID (or run scripts/start-office.sh in the repo root).");
}

export function consoleUrl(): string {
  const ws = process.env.ANTHROPIC_WORKSPACE_ID ?? "default";
  return `https://platform.claude.com/workspaces/${ws}/sessions/${sessionId()}`;
}

export type OfficeStatus = {
  status: string; // running | idle | ...
  listCostUsd: number;
  budgetUsd: number | null;
};

export async function officeStatus(): Promise<OfficeStatus> {
  const s = await anthropic().beta.sessions.retrieve(sessionId());
  const usage = (s as any).usage ?? {};
  const budget = (s as any).budget?.max_list_cost?.amount;
  return {
    status: s.status,
    listCostUsd: Number(usage.list_cost?.amount ?? 0) / 100,
    budgetUsd: budget ? Number(budget) / 100 : null,
  };
}

export async function say(text: string): Promise<void> {
  await anthropic().beta.sessions.events.send(sessionId(), {
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
