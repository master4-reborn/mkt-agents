import matter from "gray-matter";

export type Kind = "brand" | "research" | "draft" | "report" | "other";

export function kindOf(name: string): Kind {
  if (name === "BRAND.md") return "brand";
  if (/^\d{4}-W\d{2}\.md$/.test(name)) return "report";
  if (/^\d{4}-W\d{2}-/.test(name)) return "research";
  if (/^\d{4}-\d{2}-\d{2}-/.test(name)) return "draft";
  return "other";
}

export type Parsed = {
  data: Record<string, unknown>;
  body: string;
  status: string | null;
  week: string | null;
  title: string;
};

export function parseFile(name: string, content: string): Parsed {
  let data: Record<string, unknown> = {};
  let body = content;
  try {
    const m = matter(content);
    data = m.data ?? {};
    body = m.content;
  } catch {
    // no front matter, keep the whole content
  }
  const status = str(data.status);
  const week = str(data.week) ?? (name.match(/^\d{4}-W\d{2}/)?.[0] ?? null);
  const topic = str(data.topic);
  const title =
    topic?.replace(/^#\d+\s*/, "") ??
    body.match(/^#\s+(.+)$/m)?.[1] ??
    name.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/-/g, " ");
  return { data, body, status, week, title };
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : v != null && typeof v !== "object" ? String(v) : null;
}

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

export const STATUS_LABEL: Record<string, string> = {
  draft: "Đang viết",
  ready: "Chờ bạn duyệt",
  "needs-fix": "Cần sửa",
  approved: "Đã duyệt",
  rejected: "Trả lại",
  done: "Xong",
  partial: "Một phần",
  template: "Mẫu",
};
