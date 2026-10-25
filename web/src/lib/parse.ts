import matter from "gray-matter";

export type Kind = "brand" | "research" | "draft" | "report" | "reply" | "other";

export function kindOf(name: string): Kind {
  if (name === "BRAND.md") return "brand";
  if (/^reply-/.test(name)) return "reply";
  if (/^\d{4}-W\d{2}\.md$/.test(name)) return "report";
  if (/^\d{4}-W\d{2}-/.test(name)) return "research";
  if (/^\d{4}-\d{2}-\d{2}-/.test(name)) return "draft";
  return "other";
}

export type Parsed = {
  data: Record<string, unknown>;
  body: string;
  status: string | null;
  statusNote: string | null; // what follows the status word, e.g. why research is only partial
  week: string | null;
  title: string;
};

export function parseFile(name: string, content: string): Parsed {
  let data: Record<string, unknown> = {};
  let body = content;
  try {
    // Options object: without one, gray-matter caches the unparsed file before parsing,
    // so a second call on the same content silently returns empty data instead of throwing.
    const m = matter(content, {});
    data = m.data ?? {};
    body = m.content;
  } catch {
    // The team writes front matter by hand; a value like `approved: 2026-10-24 (sếp: "approve")`
    // is not valid YAML. Fall back to one `key: value` per line.
    const loose = looseFrontMatter(content);
    data = loose.data;
    body = loose.body;
  }
  const rawStatus = str(data.status);
  const status = rawStatus?.split(/\s+/)[0]?.toLowerCase() ?? null;
  const statusNote = rawStatus?.replace(/^\S+\s*[—–-]?\s*/, "").trim() || null;
  const week = str(data.week) ?? (name.match(/^\d{4}-W\d{2}/)?.[0] ?? null);
  const topic = str(data.topic);
  const title =
    topic?.replace(/^#\d+\s*/, "") ??
    body.match(/^#\s+(.+)$/m)?.[1] ??
    name.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/-/g, " ");
  return { data, body, status, statusNote, week, title };
}

function looseFrontMatter(content: string): { data: Record<string, unknown>; body: string } {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: content };
  const data: Record<string, unknown> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kv) data[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
  }
  return { data, body: content.slice(m[0].length) };
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : v != null && typeof v !== "object" ? String(v) : null;
}

export const STATUS_LABEL: Record<string, string> = {
  draft: "Đang viết",
  ready: "Chờ bạn duyệt",
  "needs-fix": "Đang sửa",
  approved: "Đã duyệt",
  rejected: "Trả lại",
  posted: "Đã đăng",
  done: "Xong",
  partial: "Một phần",
  template: "Mẫu",
};

/* ---------- sections ---------- */

export type Section = { title: string; text: string };

// Splits a markdown body on "## " headings. Text before the first heading has title "".
export function sections(body: string): Section[] {
  const out: Section[] = [];
  let cur: Section = { title: "", text: "" };
  for (const line of body.split("\n")) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) {
      out.push(cur);
      cur = { title: h[1], text: "" };
    } else cur.text += line + "\n";
  }
  out.push(cur);
  return out.map((s) => ({ title: s.title, text: s.text.trim() })).filter((s) => s.title || s.text);
}

const section = (body: string, re: RegExp) => sections(body).find((s) => re.test(s.title))?.text ?? "";

// A draft file is: the post under "## Bài đăng", then sources, notes and QA checklists.
export function splitDraft(body: string): { post: string; rest: string } {
  const lines = body.split("\n");
  const start = lines.findIndex((l) => /^##\s*Bài đăng/i.test(l));
  if (start < 0) return { post: body.trim(), rest: "" };
  let end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  if (end < 0) end = lines.length;
  return {
    post: lines.slice(start + 1, end).join("\n").trim(),
    rest: [...lines.slice(0, start), ...lines.slice(end)].join("\n").trim(),
  };
}

/* ---------- drafts ---------- */

const PLACEHOLDER = /\[CẦN SẾP XÁC NHẬN:?\s*([^\]]*)\]/gi;

// "[CẦN SẾP XÁC NHẬN: số túi mỗi bình]" → "số túi mỗi bình"
export function placeholders(post: string): string[] {
  return [...post.matchAll(PLACEHOLDER)].map((m) => m[1].trim()).filter(Boolean);
}

// The post split into plain text and placeholder runs, for highlighting.
export function postParts(post: string): { text: string; placeholder: boolean }[] {
  const parts: { text: string; placeholder: boolean }[] = [];
  let last = 0;
  for (const m of post.matchAll(PLACEHOLDER)) {
    if (m.index! > last) parts.push({ text: post.slice(last, m.index), placeholder: false });
    parts.push({ text: m[1].trim() || "cần bạn điền", placeholder: true });
    last = m.index! + m[0].length;
  }
  if (last < post.length) parts.push({ text: post.slice(last), placeholder: false });
  return parts;
}

export const POST_LIMIT: Record<string, number> = { threads: 500, tiktok: 2200, facebook: 2000 };

export function postLength(post: string): number {
  return [...post.replace(/\r?\n/g, "")].length;
}

export const QA_LABEL: Record<number, string> = {
  1: "Mọi số liệu có nguồn",
  2: "Không có từ cấm",
  3: "Đúng giọng thương hiệu, có CTA",
  4: "Độ dài trong giới hạn",
  5: "Một hook, một CTA, một chủ đề",
  6: "Không hứa quá, không nêu đối thủ",
  7: "Thông tin đầu bài đầy đủ",
};

export type QaItem = { n: number; pass: boolean; text: string };
export type Qa = { items: QaItem[]; verdict: string | null; round: number };

// The last "## QA checklist" section: one PASS/FAIL per numbered line, plus the verdict.
export function qaChecklist(body: string): Qa | null {
  const all = sections(body).filter((s) => /^QA checklist/i.test(s.title));
  const last = all[all.length - 1];
  if (!last) return null;
  const items: QaItem[] = [];
  for (const line of last.text.split("\n")) {
    const m = line.match(/^(\d+)\.\s*\**(PASS|FAIL)\**\s*[—–:-]\s*(.*)$/i);
    if (m) items.push({ n: Number(m[1]), pass: m[2].toUpperCase() === "PASS", text: m[3].trim() });
  }
  const verdict = last.text.match(/Kết quả:\s*\**([a-z-]+)/i)?.[1]?.toLowerCase() ?? null;
  return { items, verdict, round: all.length };
}

// Bullets under "## Cần sếp xác nhận": what the writer wants the boss to look at.
export function bossNotes(body: string): string[] {
  return bullets(section(body, /^Cần sếp/i)).map((n) => n.replace(PLACEHOLDER, (_, p1: string) => `chỗ trống “${p1.trim()}”`));
}

// Bullets under "## Nguồn": where each fact in the post comes from.
export function sourceNotes(body: string): string[] {
  return bullets(section(body, /^Nguồn/i));
}

function bullets(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.match(/^\s*[-*]\s+(.*)$/)?.[1]?.trim() ?? "")
    .filter(Boolean);
}

// "E1 (matcha đắt, pha phức tạp) trong research/..." → codes ["E1"], summary "matcha đắt, pha phức tạp"
export function painPoint(raw: unknown): { codes: string[]; summary: string } {
  const s = typeof raw === "string" ? raw : "";
  const codes = [...new Set([...s.matchAll(/\b([A-H]\d)\b/g)].map((m) => m[1]))];
  const paren = s.match(/\(([^)]+)\)/)?.[1];
  const summary = (paren ?? s.replace(/\s+trong\s+research\/.*$/i, ""))
    .replace(/^Nhóm\s+[A-H]\s*/i, "")
    .replace(/^(?:[A-H]\d(?:\s*,\s*)?)+\s*:?\s*/, "")
    .trim();
  return { codes, summary };
}

export function topicNumber(raw: unknown): number | null {
  const m = typeof raw === "string" ? raw.match(/^#(\d+)/) : null;
  return m ? Number(m[1]) : null;
}

/* ---------- research ---------- */

export type Row = string[];

// Every markdown table in the text, as header + rows of trimmed cells.
export function mdTables(text: string): { header: Row; rows: Row[] }[] {
  const tables: { header: Row; rows: Row[] }[] = [];
  let cur: Row[] = [];
  const flush = () => {
    if (cur.length >= 2) tables.push({ header: cur[0], rows: cur.slice(1) });
    cur = [];
  };
  for (const line of text.split("\n")) {
    if (/^\s*\|/.test(line)) {
      if (/^\s*\|?\s*:?-{2,}/.test(line)) continue; // separator row
      cur.push(line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
    } else flush();
  }
  flush();
  return tables;
}

export type Quote = { code: string; quote: string; source: string; url: string | null };

// comments.md: rows like | A1 | "quote" | who, where — https://... |
export function commentQuotes(body: string): Quote[] {
  const out: Quote[] = [];
  for (const t of mdTables(body)) {
    for (const r of t.rows) {
      if (!/^[A-H]\d$/.test(r[0] ?? "") || r.length < 3) continue;
      const src = r[2].replace(/\[[^\]]*\]/g, "").trim();
      const url = src.match(/https?:\/\/\S+/)?.[0] ?? null;
      out.push({ code: r[0], quote: md(r[1]).replace(/^"|"$/g, "").replace(/^“|”$/g, ""), source: md(src.split(/\s+[—–-]\s+/)[0]).trim(), url });
    }
  }
  return out;
}

export type Pain = { group: string; pain: string; count: number | null; matches: string | null };

// comments.md summary table: | Nhóm | Nỗi đau | Số lần thấy | Khớp ghi chú sếp? |
export function painTable(body: string): Pain[] {
  for (const t of mdTables(body)) {
    const rows = t.rows.filter((r) => /^[A-H]$/.test(r[0] ?? ""));
    if (rows.length) return rows.map((r) => ({ group: r[0], pain: md(r[1] ?? ""), count: r[2] ? Number(r[2].match(/\d+/)?.[0] ?? NaN) || null : null, matches: r[3] ? md(r[3]) : null }));
  }
  return [];
}

export type Topic = { n: number; title: string; fields: { label: string; value: string }[] };

// topics.md: "## 1. Title" sections with "- **Label:** value" bullets.
export function topicsList(body: string): Topic[] {
  return sections(body)
    .map((s) => {
      const m = s.title.match(/^(\d+)\.\s*(.+)$/);
      if (!m) return null;
      const fields = s.text
        .split("\n")
        .map((l) => l.match(/^\s*[-*]\s+\*\*([^*]+?):?\*\*:?\s*(.*)$/))
        .filter(Boolean)
        .map((x) => ({ label: x![1].replace(/:$/, "").trim(), value: md(x![2]) }));
      return { n: Number(m[1]), title: md(m[2]), fields };
    })
    .filter((t): t is Topic => !!t);
}

export type Competitor = { name: string; fields: { label: string; value: string }[] };

// competitors.md: the first table whose first column is the competitor.
export function competitorTable(body: string): Competitor[] {
  const t = mdTables(body).find((t) => /đối thủ|tài khoản/i.test(t.header[0] ?? ""));
  if (!t) return [];
  return t.rows.map((r) => ({
    name: md(r[0] ?? "").replace(/\s*\(.*\)\s*$/, ""),
    fields: t.header.slice(1).map((h, i) => ({ label: md(h), value: md(r[i + 1] ?? "") })).filter((f) => f.value && f.value !== "—"),
  }));
}

/* ---------- brand card ---------- */

export type Field = { label: string; value: string; items: string[]; estimated: boolean };
export type BrandSection = { title: string; fields: Field[]; items: string[] };

// BRAND.md: "## Section" → "- **Label:** value" bullets, each with optional indented sub-items.
export function brandCard(body: string): BrandSection[] {
  return sections(body)
    .filter((s) => s.title)
    .map((s) => {
      const fields: Field[] = [];
      const items: string[] = [];
      for (const line of s.text.split("\n")) {
        const f = line.match(/^[-*]\s+\*\*([^*]+?):?\*\*:?\s*(.*)$/);
        if (f) {
          const raw = f[2].trim();
          fields.push({ label: f[1].replace(/:$/, "").trim(), value: md(raw.replace(/\s*\(ước tính[^)]*\)/gi, "").replace(/\s*\(sếp xác nhận[^)]*\)/gi, "")), items: [], estimated: /ước tính/i.test(raw) });
          continue;
        }
        const sub = line.match(/^\s{2,}(?:[-*]|\d+\.)\s+(.*)$/);
        if (sub && fields.length) {
          fields[fields.length - 1].items.push(md(sub[1]));
          continue;
        }
        const top = line.match(/^[-*]\s+(.*)$/);
        if (top) items.push(md(top[1]));
        else if (line.trim() && !fields.length && !items.length && !/^[A-Za-z]/.test(line) && !/^Nguồn/.test(line)) items.push(md(line.trim()));
      }
      return { title: s.title, fields, items };
    });
}

/* ---------- the lead's messages ---------- */

export type Report = { done: string; files: string; needs: string; more: string };

// The lead's three-line report, in Vietnamese labels (Đã làm / File / Cần bạn) or the English ones
// it used before. Each part ends at the first blank line; everything after goes to `more`.
export function parseReport(text: string): Report | null {
  const re = /^\s*(?:\d+[.)]\s*)?(?:\*\*)?(Đã làm|Done|File|Files|Cần bạn|Needs you|Cần sếp)(?:\*\*)?\s*:\s*/im;
  if (!re.test(text)) return null;
  const parts: Record<string, string> = {};
  let more = "";
  let key: string | null = null;
  let closed = false;
  for (const line of text.split("\n")) {
    const m = line.match(re);
    if (m && !closed) {
      const k = /Đã làm|Done/i.test(m[1]) ? "done" : /File/i.test(m[1]) ? "files" : "needs";
      key = k;
      parts[k] = line.slice(m[0].length).trim();
      continue;
    }
    if (key && !closed) {
      if (!line.trim()) {
        if (parts.done !== undefined && parts.needs !== undefined) closed = true;
        key = null;
        continue;
      }
      if (/^\s{2,}\S|^\s*[-*|]/.test(line) && key === "needs") {
        // indented detail or a table after "Cần bạn": belongs to `more`
        closed = true;
        more += line + "\n";
        continue;
      }
      parts[key] += " " + line.trim();
      continue;
    }
    more += line + "\n";
  }
  if (parts.done === undefined && parts.needs === undefined) return null;
  return { done: md(parts.done ?? ""), files: md(parts.files ?? ""), needs: md(parts.needs ?? ""), more: more.trim() };
}

// Strips inline markdown so a value reads as plain text.
export function md(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1")
    .trim();
}

export type FileRef = { name: string; kind: Kind; title: string; week: string | null; post?: string | null };

// What friendly() needs to know about a synced file. Replies also carry which post they answer.
export function fileRef(f: { name: string; kind: string; title: string | null; week: string | null; content: string }): FileRef {
  const post = f.kind === "reply" ? str(parseFile(f.name, f.content).data.post) : null;
  return { name: f.name, kind: f.kind as Kind, title: f.title ?? f.name, week: f.week, post };
}

// A reply file: "## Bình luận" (the customer's words) and "## Trả lời" (what the team suggests you answer).
export function replyParts(body: string): { comment: string; reply: string } {
  const s = sections(body);
  const pick = (re: RegExp) => s.find((x) => re.test(x.title))?.text.trim() ?? "";
  return { comment: pick(/bình luận|comment/i), reply: pick(/trả lời|reply/i) || (s[0]?.text.trim() ?? "") };
}

// Replaces the file paths the team writes ("content/drafts/2026-10-24-x.md", "/mnt/session/outputs/...")
// with the post's title as a link, so the boss never reads a path.
export function friendly(text: string, files: FileRef[]): string {
  const byName = new Map(files.map((f) => [f.name, f]));
  const path = /`?(?:\/mnt\/session\/outputs\/|\/workspace\/)?(?:[\w.-]+\/)*((?:\d{4}-\d{2}-\d{2}-[\w-]+|\d{4}-W\d{2}(?:-[\w-]+)?|reply-[\w-]+|BRAND)\.md)`?/g;
  let out = text.replace(path, (whole, name: string) => {
    const f = byName.get(name);
    if (name === "BRAND.md") return "[thẻ thương hiệu](/brand)";
    if (f?.kind === "draft") return `[“${f.title}”](/drafts/${encodeURIComponent(name)})`;
    if (f?.kind === "report") return `[báo cáo tuần ${weekNo(f.week)}](/reports/${encodeURIComponent(name)})`;
    if (f?.kind === "reply") return f.post ? `[câu trả lời cho khách](/drafts/${encodeURIComponent(f.post)}#tra-loi)` : "câu trả lời cho khách";
    if (/^\d{4}-W\d{2}-/.test(name)) return `[nghiên cứu tuần ${weekNo(name.slice(0, 8))}](/research)`;
    if (f) return `[${f.title}](/drafts/${encodeURIComponent(name)})`;
    return whole.replace(/`/g, "");
  });
  out = out.replace(/`?\/mnt\/session\/outputs\/[\w./-]*`?/g, "trang này").replace(/`?\/workspace\/[\w./-]*`?/g, "văn phòng");
  return out;
}

export function weekNo(week: string | null | undefined): string {
  return week?.match(/W(\d{2})/)?.[1]?.replace(/^0/, "") ?? "";
}

// The shop's name from BRAND.md, or null while the card is still a template.
export function brandName(content: string): string | null {
  const p = parseFile("BRAND.md", content);
  const v = brandCard(p.body).find((s) => /^Shop/i.test(s.title))?.fields.find((f) => /tên/i.test(f.label))?.value.trim();
  return v && !/^</.test(v) ? v : null;
}
