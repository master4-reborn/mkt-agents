import { placeholders, splitDraft, parseFile, parseReport, friendly, type FileRef } from "./parse";

type Draft = { name: string; title: string; status: string | null; content: string; week: string | null; createdAt: Date };
type Msg = { role: string; text: string; createdAt: Date };

export type Task =
  | { kind: "post"; name: string; title: string; post: string }
  | { kind: "fill"; name: string; title: string; what: string }
  | { kind: "reply"; name: string; title: string; reply: string }
  | { kind: "metrics"; week: string; posts: number }
  | { kind: "lead"; text: string }
  | { kind: "key"; what: string; error: string; href: string }; // a connected storage rejected its key

export type Reply = { post: string; status: string | null; reply: string };

// What the boss has to do, in the order they should do it.
export function userTasks(drafts: Draft[], lastReport: Msg | null, files: FileRef[], reports: { week: string | null }[] = [], replies: Reply[] = []): Task[] {
  const tasks: Task[] = [];
  for (const d of drafts) {
    if (d.status !== "approved") continue;
    const { post } = splitDraft(parseFile(d.name, d.content).body);
    tasks.push({ kind: "post", name: d.name, title: d.title, post });
  }
  for (const d of drafts) {
    if (!["ready", "approved"].includes(d.status ?? "")) continue;
    const { post } = splitDraft(parseFile(d.name, d.content).body);
    for (const p of placeholders(post)) tasks.push({ kind: "fill", name: d.name, title: d.title, what: p });
  }
  for (const r of replies) {
    const d = drafts.find((x) => x.name === r.post);
    if (r.status === "ready" && d && r.reply) tasks.push({ kind: "reply", name: d.name, title: d.title, reply: r.reply });
  }
  // A week with posts out but no report yet: time to tell the team how they did.
  const measured = new Set(reports.map((r) => r.week));
  const byWeek = new Map<string, number>();
  for (const d of drafts) if (d.status === "posted" && d.week && !measured.has(d.week)) byWeek.set(d.week, (byWeek.get(d.week) ?? 0) + 1);
  for (const [week, posts] of [...byWeek].sort()) tasks.push({ kind: "metrics", week, posts });
  if (lastReport) {
    const r = parseReport(lastReport.text);
    const needs = r?.needs ?? "";
    // The report's "Cần bạn" line usually repeats the approvals; keep it only when it says more.
    if (needs && !/^(decide on each draft|duyệt \d+ bài)/i.test(needs)) tasks.push({ kind: "lead", text: friendly(needs, files) });
  }
  return tasks;
}

export type Step = { label: string; state: "done" | "working" | "todo" | "partial"; detail?: string };

// The four steps of a week, read from the files the team delivered and who is working now.
export function weekSteps(week: string, drafts: Draft[], research: { week: string | null }[], working: Set<string>): Step[] {
  const mine = drafts.filter((d) => d.week === week);
  const hasResearch = research.some((r) => r.week === week);
  const checked = mine.filter((d) => ["ready", "approved", "posted", "needs-fix", "rejected"].includes(d.status ?? ""));
  const passed = mine.filter((d) => ["ready", "approved", "posted"].includes(d.status ?? ""));
  const decided = mine.filter((d) => ["approved", "posted", "rejected"].includes(d.status ?? ""));
  return [
    { label: "Nghiên cứu", state: working.has("research") ? "working" : hasResearch ? "done" : "todo" },
    { label: mine.length ? `Viết ${mine.length} bài` : "Viết bài", state: working.has("writer") ? "working" : mine.length ? "done" : "todo" },
    { label: "QA soát", state: working.has("qa") ? "working" : checked.length === 0 ? "todo" : passed.length === mine.length ? "done" : "partial", detail: checked.length ? `${passed.length}/${mine.length}` : undefined },
    { label: "Bạn duyệt", state: mine.length === 0 ? "todo" : decided.length === mine.length ? "done" : "partial", detail: mine.length ? `${decided.length}/${mine.length}` : undefined },
  ];
}

// When the last week run started and ended, from the conversation.
export function lastRun(msgs: Msg[]): { startedAt: Date; finishedAt: Date | null } | null {
  const start = [...msgs].reverse().find((m) => m.role === "boss" && /^(Run week|Chạy tuần)/i.test(m.text));
  if (!start) return null;
  const after = msgs.filter((m) => m.createdAt > start.createdAt && m.role === "lead");
  const finished = after.find((m) => parseReport(m.text) && /File|Đã làm|Done/i.test(m.text) && after.indexOf(m) >= 0 && /^\s*(1[.)]|Đã làm)/im.test(m.text));
  return { startedAt: start.createdAt, finishedAt: finished?.createdAt ?? null };
}

export const hhmm = (d: Date) => d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

// Minutes since the current week run started, while the team is still on it. Null when nothing is running.
export function elapsedMinutes(run: { startedAt: Date; finishedAt: Date | null } | null, running: boolean, now = new Date()): number | null {
  if (!running || !run || run.finishedAt) return null;
  return Math.max(1, Math.round((now.getTime() - run.startedAt.getTime()) / 60000));
}
