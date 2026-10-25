// Notion REST API (version 2025-09-03: a database holds data sources; rows live in a data source).
// Every call takes the boss's internal-integration secret, which only sees the pages the boss connected to it.

const API = "https://api.notion.com/v1";
const VERSION = "2025-09-03";

export class NotionError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call(secret: string, method: string, path: string, body?: unknown): Promise<any> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${secret}`, "Notion-Version": VERSION, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await r.text();
  const json = text ? JSON.parse(text) : {};
  if (!r.ok) throw new NotionError(r.status, json.message ?? `Notion trả lỗi ${r.status}`);
  return json;
}

// "https://www.notion.so/My-page-1a2b…" or a bare id → dashed uuid; null when there is no id in it.
export function notionId(input: string): string | null {
  const m = input.replace(/[?#].*$/, "").match(/([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?!.*[0-9a-f]{32})/i);
  if (!m) return null;
  const h = m[1].replace(/-/g, "").toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const plain = (rt: any[] | undefined): string => (rt ?? []).map((t) => t.plain_text ?? "").join("");

// One property value as text, whatever its type.
export function propText(p: any): string {
  if (!p) return "";
  switch (p.type) {
    case "title": return plain(p.title);
    case "rich_text": return plain(p.rich_text);
    case "number": return p.number == null ? "" : String(p.number);
    case "select": return p.select?.name ?? "";
    case "status": return p.status?.name ?? "";
    case "multi_select": return (p.multi_select ?? []).map((s: any) => s.name).join(", ");
    case "date": return p.date ? [p.date.start, p.date.end].filter(Boolean).join(" → ") : "";
    case "checkbox": return p.checkbox ? "có" : "không";
    case "url": return p.url ?? "";
    case "email": return p.email ?? "";
    case "phone_number": return p.phone_number ?? "";
    case "people": return (p.people ?? []).map((u: any) => u.name ?? "").filter(Boolean).join(", ");
    case "files": return (p.files ?? []).map((f: any) => f.name ?? "").join(", ");
    case "formula": return String(p.formula?.string ?? p.formula?.number ?? p.formula?.boolean ?? p.formula?.date?.start ?? "");
    case "rollup": return String(p.rollup?.number ?? plain(p.rollup?.array?.flatMap((x: any) => x.title ?? x.rich_text ?? [])) ?? "");
    case "created_time": return p.created_time ?? "";
    case "last_edited_time": return p.last_edited_time ?? "";
    case "unique_id": return p.unique_id ? `${p.unique_id.prefix ?? ""}${p.unique_id.number}` : "";
    case "relation": return (p.relation ?? []).length ? `${p.relation.length} liên kết` : "";
    default: return "";
  }
}

export function pageTitle(page: any): string {
  const props = page?.properties ?? {};
  const t = Object.values(props).find((p: any) => p.type === "title") as any;
  return (t ? plain(t.title) : "") || plain(page?.title) || "(không tên)";
}

export async function notionMe(secret: string): Promise<{ name: string; workspace: string }> {
  const me = await call(secret, "GET", "/users/me");
  return { name: me.name ?? "Tích hợp", workspace: me.bot?.workspace_name ?? "" };
}

export type DataSourceRef = { id: string; name: string };

export async function getDatabase(secret: string, id: string): Promise<{ id: string; title: string; url: string; dataSources: DataSourceRef[] }> {
  const d = await call(secret, "GET", `/databases/${id}`);
  return { id: d.id, title: plain(d.title) || "(không tên)", url: d.url ?? "", dataSources: (d.data_sources ?? []).map((s: any) => ({ id: s.id, name: s.name ?? "" })) };
}

export async function getDataSource(secret: string, id: string): Promise<{ id: string; title: string; databaseId: string | null; columns: string[] }> {
  const d = await call(secret, "GET", `/data_sources/${id}`);
  return { id: d.id, title: plain(d.title) || "(không tên)", databaseId: d.parent?.database_id ?? null, columns: Object.keys(d.properties ?? {}) };
}

export async function getPage(secret: string, id: string): Promise<{ id: string; title: string; url: string }> {
  const p = await call(secret, "GET", `/pages/${id}`);
  return { id: p.id, title: pageTitle(p), url: p.url ?? "" };
}

export type Row = { id: string; url: string; title: string; fields: Record<string, string> };

// Rows of one data source, newest edit first; `query` keeps only rows whose text contains it (Notion filters need a column,
// a plain word search does not). Reads up to three pages of 100.
export async function queryDataSource(secret: string, dsId: string, opts: { query?: string; limit?: number } = {}): Promise<Row[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const q = (opts.query ?? "").trim().toLowerCase();
  const out: Row[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 3 && out.length < limit; i++) {
    const res = await call(secret, "POST", `/data_sources/${dsId}/query`, { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}), sorts: [{ timestamp: "last_edited_time", direction: "descending" }] });
    for (const p of res.results ?? []) {
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(p.properties ?? {})) {
        const t = propText(v);
        if (t) fields[k] = t;
      }
      const row = { id: p.id, url: p.url ?? "", title: pageTitle(p), fields };
      if (!q || [row.title, ...Object.values(fields)].join(" ").toLowerCase().includes(q)) out.push(row);
      if (out.length >= limit) break;
    }
    if (!res.has_more) break;
    cursor = res.next_cursor;
  }
  return out;
}

export async function search(secret: string, query: string, limit = 20): Promise<{ object: string; id: string; title: string; url: string }[]> {
  const res = await call(secret, "POST", "/search", { query, page_size: Math.min(limit, 100) });
  return (res.results ?? []).map((r: any) => ({ object: r.object, id: r.id, title: r.object === "data_source" || r.object === "database" ? plain(r.title) || "(không tên)" : pageTitle(r), url: r.url ?? "" }));
}

// The text of a page as markdown-ish lines: children blocks, two levels deep.
export async function pageText(secret: string, pageId: string): Promise<string> {
  const lines = await blockLines(secret, pageId, 0);
  return lines.join("\n");
}

async function blockLines(secret: string, blockId: string, depth: number): Promise<string[]> {
  const lines: string[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 5; i++) {
    const res = await call(secret, "GET", `/blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`);
    for (const b of res.results ?? []) {
      const t = b.type;
      const body = plain(b[t]?.rich_text);
      const pad = "  ".repeat(depth);
      const line =
        t === "heading_1" ? `# ${body}` :
        t === "heading_2" ? `## ${body}` :
        t === "heading_3" ? `### ${body}` :
        t === "bulleted_list_item" ? `- ${body}` :
        t === "numbered_list_item" ? `1. ${body}` :
        t === "to_do" ? `- [${b.to_do?.checked ? "x" : " "}] ${body}` :
        t === "quote" ? `> ${body}` :
        t === "callout" ? `> ${body}` :
        t === "toggle" ? `▸ ${body}` :
        t === "code" ? `\`\`\`\n${body}\n\`\`\`` :
        t === "divider" ? "---" :
        t === "child_page" ? `[Trang con] ${b.child_page?.title ?? ""}` :
        t === "child_database" ? `[Bảng] ${b.child_database?.title ?? ""}` :
        t === "table" ? "[bảng]" :
        t === "table_row" ? (b.table_row?.cells ?? []).map((c: any[]) => plain(c)).join(" | ") :
        t === "image" ? `[ảnh] ${b.image?.caption ? plain(b.image.caption) : ""}` :
        t === "bookmark" ? `[liên kết] ${b.bookmark?.url ?? ""}` :
        body;
      if (line.trim()) lines.push(pad + line);
      if (b.has_children && depth < 2 && t !== "child_page" && t !== "child_database") lines.push(...(await blockLines(secret, b.id, depth + 1)));
    }
    if (!res.has_more) break;
    cursor = res.next_cursor;
  }
  return lines;
}

// Rich text in chunks of 2000 characters, Notion's limit per text object.
export function rich(text: string): any[] {
  const out: any[] = [];
  for (let i = 0; i < text.length; i += 2000) out.push({ type: "text", text: { content: text.slice(i, i + 2000) } });
  return out.length ? out : [{ type: "text", text: { content: "" } }];
}

// Markdown as the team writes it (headings, lists, quotes, dividers, paragraphs) → Notion blocks.
export function mdToBlocks(md: string): any[] {
  const blocks: any[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ object: "block", type: "paragraph", paragraph: { rich_text: rich(para.join("\n")) } });
    para = [];
  };
  for (const raw of md.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    let m: RegExpMatchArray | null;
    if (!line.trim()) { flush(); continue; }
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) { flush(); const lvl = m[1].length; blocks.push({ object: "block", type: `heading_${lvl}`, [`heading_${lvl}`]: { rich_text: rich(m[2]) } }); continue; }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { flush(); blocks.push({ object: "block", type: "divider", divider: {} }); continue; }
    if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) { flush(); blocks.push({ object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: rich(m[1]) } }); continue; }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { flush(); blocks.push({ object: "block", type: "numbered_list_item", numbered_list_item: { rich_text: rich(m[1]) } }); continue; }
    if ((m = line.match(/^>\s?(.*)$/))) { flush(); blocks.push({ object: "block", type: "quote", quote: { rich_text: rich(m[1]) } }); continue; }
    para.push(line.replace(/\*\*([^*]+)\*\*/g, "$1"));
  }
  flush();
  return blocks;
}

const SCHEMA = {
  "Tên": { title: {} },
  "Thương hiệu": { rich_text: {} },
  "Tuần": { rich_text: {} },
  "Ngày": { date: {} },
  "Trạng thái": { rich_text: {} },
  "Tệp": { rich_text: {} },
};

// A database under the save page with the team's six columns; returns its data source, where rows are created.
export async function createDatabase(secret: string, parentPageId: string, title: string): Promise<{ id: string; dataSourceId: string }> {
  const d = await call(secret, "POST", "/databases", {
    parent: { type: "page_id", page_id: parentPageId },
    title: [{ type: "text", text: { content: title } }],
    initial_data_source: { properties: SCHEMA },
  });
  let ds = d.data_sources?.[0]?.id as string | undefined;
  if (!ds) ds = (await getDatabase(secret, d.id)).dataSources[0]?.id;
  if (!ds) throw new NotionError(500, "Notion tạo bảng nhưng không trả về nguồn dữ liệu");
  return { id: d.id, dataSourceId: ds };
}

export type RowInput = { title: string; brand: string; week: string; date: string; status: string; file: string; body: string };

export async function createRow(secret: string, dataSourceId: string, r: RowInput): Promise<{ id: string; url: string }> {
  const blocks = mdToBlocks(r.body);
  const page = await call(secret, "POST", "/pages", {
    parent: { type: "data_source_id", data_source_id: dataSourceId },
    properties: {
      "Tên": { title: rich(r.title.slice(0, 200)) },
      "Thương hiệu": { rich_text: rich(r.brand) },
      "Tuần": { rich_text: rich(r.week) },
      "Ngày": { date: { start: r.date } },
      "Trạng thái": { rich_text: rich(r.status) },
      "Tệp": { rich_text: rich(r.file) },
    },
    children: blocks.slice(0, 100),
  });
  for (let i = 100; i < blocks.length; i += 100) {
    await call(secret, "PATCH", `/blocks/${page.id}/children`, { children: blocks.slice(i, i + 100) });
  }
  return { id: page.id, url: page.url ?? "" };
}
