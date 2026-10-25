// What the island knows about each employee, shared by the 3D scene and the DOM overlay.

export type MapEmployee = {
  agent: "lead" | "research" | "writer" | "qa" | "metrics";
  state: "working" | "done" | "waiting";
  task: string | null;
  report: string | null;
  since: string | null;
};
export type Agent = MapEmployee["agent"];
export type Worker = Exclude<Agent, "lead">;

export const ORDER: Worker[] = ["research", "writer", "qa", "metrics"];
export const INK = "#7a2b4c";

// One real handoff from the activity log: the lead gave a worker a task, or got a report back. `agent` is the worker.
export type Handoff = { at: string; agent: string; kind: "task" | "report"; text: string };

export const META: Record<Agent, { name: string; fur: string; roof: string; tools: string; job: string; demoTask: string }> = {
  lead: { name: "Điều phối", fur: "#fff1e6", roof: "#ff6fa3", tools: "Giao việc, đọc, ghi", job: "Nhận lệnh của bạn, chia việc, giữ cổng duyệt, báo cáo ba dòng", demoTask: "" },
  research: { name: "Nghiên cứu", fur: "#cdb8ff", roof: "#a98bff", tools: "Tìm web, đọc web, bash", job: "Quét đối thủ và bình luận, bảng nỗi đau, 5 chủ đề", demoTask: "quét đối thủ và bình luận tuần này" },
  writer: { name: "Viết bài", fur: "#ff9ec4", roof: "#ff6fa3", tools: "Chỉ đọc, ghi file", job: "3 đến 5 bài nháp mỗi tuần, đúng giọng thương hiệu", demoTask: "viết 4 bài nháp từ 5 chủ đề" },
  qa: { name: "QA-QC", fur: "#ffd0b0", roof: "#ffb06b", tools: "Chỉ đọc, ghi file", job: "Soát số liệu, từ cấm, giọng, độ dài; đặt trạng thái", demoTask: "soát 4 bài nháp, đặt trạng thái" },
  metrics: { name: "Đo số liệu", fur: "#fff0a8", roof: "#6fcfae", tools: "Đọc CSV, bash", job: "So sánh tuần, lặp lại / bỏ, việc cho thứ 2", demoTask: "so số liệu tuần này với tuần trước" },
};

export const STATE_LABEL = { working: "Đang chạy", done: "Xong việc", waiting: "Chờ việc" } as const;
export const STATE_COLOR = { working: "#f59e0b", done: "#10b981", waiting: "#c4b5c9" } as const;

// Each building is a door to the page about that employee's work.
export const DOOR: Record<Agent, { href: string; label: string }> = {
  lead: { href: "/chat", label: "Mở trò chuyện" },
  research: { href: "/research", label: "Mở Nghiên cứu" },
  writer: { href: "/drafts", label: "Mở Bài" },
  qa: { href: "/drafts", label: "Mở Bài" },
  metrics: { href: "/reports", label: "Mở Báo cáo" },
};

// Ready orders for the lead (the composer's chips). "Chạy tuần mới" is a form of its own, so it is not here.
export const LEAD_QUICK: { label: string; text: string }[] = [
  { label: "Viết thêm 1 bài", text: "Viết thêm 1 bài từ chủ đề hay nhất tuần này: writer viết nháp, qa kiểm, rồi báo cáo." },
  { label: "Soát lại bài chờ", text: "Soát lại các bài đang chờ duyệt: qa kiểm số liệu, từ cấm, giọng và độ dài, sửa rồi báo cáo." },
];

// Two ready orders per worker. They still go through the lead, who hands them on.
export const WORKER_QUICK: Record<Worker, { label: string; text: string }[]> = {
  research: [
    { label: "Tìm thêm 3 chủ đề", text: "tìm thêm 3 chủ đề mới cho tuần này, thêm vào bảng chủ đề và báo cáo." },
    { label: "Xem lại đối thủ", text: "quét lại đối thủ tuần này, cập nhật phần đối thủ trong nghiên cứu và báo cáo." },
  ],
  writer: [
    { label: "Viết thêm 1 bài", text: "viết thêm 1 bài nháp từ chủ đề hay nhất tuần này, đưa qa kiểm rồi báo cáo." },
    { label: "Viết lại bài mới nhất ngắn hơn", text: "viết lại bài nháp mới nhất ngắn hơn một nửa, giữ ý chính, đưa qa kiểm rồi báo cáo." },
  ],
  qa: [
    { label: "Soát lại bài chờ", text: "soát lại các bài đang chờ duyệt: số liệu, từ cấm, giọng, độ dài; đặt lại trạng thái và báo cáo." },
    { label: "Kiểm từ cấm", text: "kiểm từ cấm trong mọi bài nháp của tuần này, liệt kê chỗ cần sửa và báo cáo." },
  ],
  metrics: [
    { label: "So tuần này với tuần trước", text: "so số liệu tuần này với tuần trước, bài nào lặp lại, bài nào bỏ, và báo cáo." },
    { label: "Việc cho thứ Hai", text: "từ số liệu mới nhất, đề xuất việc cho thứ Hai tới và báo cáo." },
  ],
};

// A private order is still sent to the lead, who delegates it.
export function privateOrder(agent: Worker, text: string): string {
  return `Chuyển cho ${agent}: ${text}`;
}

// The first lines of a report, plain, for a speech bubble.
export function firstLines(text: string | null, lines = 2, max = 150): string {
  if (!text) return "";
  const out = text
    .replace(/[*_`#>]/g, "")
    .split(/\n/)
    .map((l) => l.replace(/^\s*(\d+[.)]|[-•])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, lines)
    .join(" ");
  return out.length > max ? `${out.slice(0, max - 1).trimEnd()}…` : out;
}
