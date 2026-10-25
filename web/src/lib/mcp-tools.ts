import { getDb, brands } from "./db";
import { brandNotion, connection, connectionSecret, markConnection } from "./connections";
import { getDatabase, getDataSource, getPage, notionId, pageText, queryDataSource, search, NotionError } from "./notion";
import { currentFiles } from "./sync";
import { brandName } from "./parse";
import { shortSentence } from "./brands";

// The read-only tools the lead gets through /api/mcp. Every tool reads with the boss's key and returns text;
// nothing here writes outside the office. Descriptions are in Vietnamese because the lead works in Vietnamese.

export type Tool = { name: string; description: string; inputSchema: Record<string, unknown> };

// The database each brand's boss chose to read, by brand name, so the lead can pick the right one from the description.
async function readTargets(): Promise<{ brand: string; title: string; ds: string }[]> {
  const db = await getDb();
  const out: { brand: string; title: string; ds: string }[] = [];
  for (const b of await db.select().from(brands)) {
    const { read } = brandNotion(b);
    if (!read) continue;
    const card = (await currentFiles(b.id, "brand"))[0];
    out.push({ brand: (card && brandName(card.content)) || shortSentence(b.sentence), title: read.title, ds: read.dataSourceId });
  }
  return out;
}

export async function listTools(): Promise<Tool[]> {
  const out: Tool[] = [];
  if (await connection("notion")) {
    const targets = await readTargets();
    const chosen = targets.length ? ` Bảng sếp đã chọn: ${targets.map((t) => `«${t.title}» (nguồn ${t.ds}) cho thương hiệu ${t.brand}`).join("; ")}.` : "";
    out.push(
      {
        name: "notion_query",
        description: `Đọc các dòng của một bảng Notion của sếp (chỉ đọc). Dùng khi nghiên cứu, hoặc khi sếp nhắc đến bảng Notion; trích dẫn là "theo bảng Notion «tên bảng»".${chosen} Truyền id nguồn dữ liệu, link bảng hoặc tên bảng; thêm "query" để chỉ lấy dòng chứa từ đó.`,
        inputSchema: { type: "object", properties: { database: { type: "string", description: "Id nguồn dữ liệu, link bảng hoặc tên bảng" }, query: { type: "string", description: "Từ cần tìm trong các dòng (tuỳ chọn)" }, limit: { type: "integer", description: "Số dòng tối đa, mặc định 50, tối đa 200" } }, required: ["database"] },
      },
      {
        name: "notion_page",
        description: "Đọc nội dung một trang Notion của sếp (chỉ đọc): tiêu đề và các khối văn bản, hai cấp. Truyền id hoặc link trang.",
        inputSchema: { type: "object", properties: { page: { type: "string", description: "Id hoặc link trang" } }, required: ["page"] },
      },
      {
        name: "notion_search",
        description: "Tìm trang và bảng Notion mà sếp đã chia sẻ cho đội, theo từ khoá. Trả về tên, id và link.",
        inputSchema: { type: "object", properties: { query: { type: "string", description: "Từ khoá" } }, required: ["query"] },
      },
    );
  }
  return out;
}

export async function callTool(name: string, args: Record<string, unknown>): Promise<{ text: string; isError?: boolean }> {
  try {
    if (name.startsWith("notion_")) {
      const secret = await connectionSecret("notion");
      if (!secret) return { text: "Notion chưa được kết nối.", isError: true };
      const text = await notionTool(secret, name, args);
      markConnection("notion", true).catch(() => {});
      return { text };
    }
    return { text: `Không có công cụ ${name}.`, isError: true };
  } catch (e) {
    if (e instanceof NotionError && (e.status === 401 || e.status === 403)) markConnection("notion", false, "Notion từ chối khoá, dán lại khoá").catch(() => {});
    return { text: `Lỗi: ${e instanceof Error ? e.message : String(e)}`, isError: true };
  }
}

async function resolveDataSource(secret: string, input: string): Promise<{ id: string; title: string }> {
  const id = notionId(input);
  if (id) {
    try {
      const ds = await getDataSource(secret, id);
      return { id: ds.id, title: ds.title };
    } catch {
      const d = await getDatabase(secret, id);
      if (!d.dataSources[0]) throw new Error(`Bảng «${d.title}» không có nguồn dữ liệu`);
      return { id: d.dataSources[0].id, title: d.title };
    }
  }
  const want = input.trim().toLowerCase();
  const chosen = (await readTargets()).find((t) => t.title.toLowerCase().includes(want) || want.includes(t.title.toLowerCase()));
  if (chosen) return { id: chosen.ds, title: chosen.title };
  const found = await search(secret, input, 10);
  const ds = found.find((r) => r.object === "data_source");
  if (ds) return { id: ds.id, title: ds.title };
  const dbRef = found.find((r) => r.object === "database");
  if (dbRef) {
    const d = await getDatabase(secret, dbRef.id);
    if (d.dataSources[0]) return { id: d.dataSources[0].id, title: d.title };
  }
  throw new Error(`Không tìm thấy bảng «${input}». Sếp cần chia sẻ bảng đó cho tích hợp trong Notion.`);
}

async function notionTool(secret: string, name: string, a: Record<string, unknown>): Promise<string> {
  if (name === "notion_search") {
    const res = await search(secret, String(a.query ?? ""), 20);
    return res.length ? res.map((r) => `- ${r.object === "page" ? "Trang" : "Bảng"}: ${r.title} · ${r.id}${r.url ? ` · ${r.url}` : ""}`).join("\n") : "Không tìm thấy gì.";
  }
  if (name === "notion_page") {
    const id = notionId(String(a.page ?? ""));
    if (!id) throw new Error("Thiếu id hoặc link trang");
    const p = await getPage(secret, id);
    const text = await pageText(secret, id);
    return `# ${p.title}\n\n${text || "(trang trống)"}`.slice(0, 60000);
  }
  if (name === "notion_query") {
    const ds = await resolveDataSource(secret, String(a.database ?? ""));
    const query = a.query ? String(a.query) : undefined;
    const rows = await queryDataSource(secret, ds.id, { query, limit: Number(a.limit) || 50 });
    if (rows.length === 0) return `Bảng «${ds.title}»: không có dòng nào${query ? ` chứa "${query}"` : ""}.`;
    const lines = rows.map((r, i) => `${i + 1}. ${r.title}${Object.entries(r.fields).filter(([, v]) => v !== r.title).map(([k, v]) => ` · ${k}: ${v}`).join("")}`);
    return `Bảng «${ds.title}» · ${rows.length} dòng\n${lines.join("\n")}`.slice(0, 80000);
  }
  throw new Error(`Không có công cụ ${name}`);
}
