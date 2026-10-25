import { anthropic } from "./anthropic";
import { getDb, memories } from "./db";

// The team's notebook: six small text files, one fact per line, newest first. The lead writes them during its work;
// the boss reads, adds and deletes lines on the Thương hiệu page. Edits go to the API first, then to the local mirror.

export const BRAND_FILES: [string, string][] = [["/bai-hoc.md", "Bài học"], ["/bai-tot.md", "Bài tốt"], ["/khach-hoi.md", "Khách hay hỏi"]];
export const SEP_FILES: [string, string][] = [["/quyet-dinh.md", "Sếp thích"], ["/threads.md", "Ăn khách trên Threads"], ["/tu-cam.md", "Từ cấm ở mọi shop"]];

export type Line = { text: string; date: string | null; rest: string };

// Header lines (#) and blanks are not facts.
export function lessonLines(content: string): Line[] {
  return content
    .split("\n")
    .filter((t) => t.trim() && !t.startsWith("#"))
    .map((text) => {
      const m = text.match(/^(\d{4}-(?:W\d{2}|\d{2}-\d{2}))\s*·\s*(.*)$/);
      return { text, date: m?.[1] ?? null, rest: (m?.[2] ?? text).trim() };
    });
}

// A line the boss types on the page, in the files' own format.
export function bossLine(text: string): string {
  return `${new Date().toISOString().slice(0, 10)} · ${text.replace(/\s+/g, " ").trim()} · sếp ghi trực tiếp`;
}

// Rewrites one file through the API, reading it fresh first (the team may have written since the last poll) and
// guarding the write with its content hash, then mirrors the result locally.
async function rewrite(store: string, path: string, edit: (content: string) => string): Promise<void> {
  const client = anthropic();
  let found: { id: string; content: string; content_sha256: string } | null = null;
  for await (const m of client.beta.memoryStores.memories.list(store, { view: "full" })) {
    if (m.type === "memory" && m.path === path) { found = { id: m.id, content: m.content ?? "", content_sha256: m.content_sha256 }; break; }
  }
  const next = edit(found?.content ?? "");
  if (found && next === found.content) return;
  const saved = found
    ? await client.beta.memoryStores.memories.update(found.id, { memory_store_id: store, content: next, precondition: { type: "content_sha256", content_sha256: found.content_sha256 } })
    : await client.beta.memoryStores.memories.create(store, { path, content: next });
  const db = await getDb();
  const row = { id: saved.id, store, path, content: next, sha256: saved.content_sha256, updatedAt: new Date(saved.updated_at) };
  await db.insert(memories).values(row).onConflictDoUpdate({ target: memories.id, set: row });
}

// Newest first: the line goes under the header lines, above the first fact.
export function addLine(store: string, path: string, line: string): Promise<void> {
  return rewrite(store, path, (content) => {
    const lines = content.split("\n");
    const first = lines.findIndex((t) => t.trim() && !t.startsWith("#"));
    if (first === -1) return [...lines.filter((t) => t.trim()), line].join("\n") + "\n";
    lines.splice(first, 0, line);
    return lines.join("\n");
  });
}

export function removeLine(store: string, path: string, text: string): Promise<void> {
  return rewrite(store, path, (content) => content.split("\n").filter((t) => t !== text).join("\n"));
}
