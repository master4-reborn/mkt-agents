"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, decisions } from "@/lib/db";
import { say, weekLabel, officeStatus, memoryStoreId } from "@/lib/office";
import { requireAuth, login } from "@/lib/auth";
import { sync, currentFiles, fileByName } from "@/lib/sync";
import { allBrands, createBrand, reopenBrand, requireBrand, setCurrentBrand } from "@/lib/brands";
import { addLine, removeLine, bossLine, BRAND_FILES, SEP_FILES } from "@/lib/memory";

// Orders go to the lead in Vietnamese so it answers in Vietnamese (it mirrors the boss's language).
const WEEK_ORDER = (week: string, note: string) =>
  `Chạy tuần ${week}.\n\nLàm theo chu trình tuần: nghiên cứu, rồi viết 3 đến 5 bài, rồi QA, rồi chép các file của tuần vào /mnt/session/outputs/${week}/ và báo cáo.\n\nGhi chú của sếp cho tuần này: ${note || "không có"}`;

// Sends an order to one brand's lead, then pulls that office once so the page that renders next already shows
// the order and the team's new status. Pages themselves never wait on the office.
async function order(sid: string, text: string) {
  await say(sid, text);
  await Promise.all([sync(sid).catch(() => {}), officeStatus(sid).catch(() => {})]);
  revalidatePath("/", "layout");
}

export async function runWeek(formData: FormData) {
  const b = await requireBrand();
  const note = String(formData.get("note") ?? "").trim();
  await order(b.id, WEEK_ORDER(weekLabel(), note));
}

// The numbers of the posts you published, one row per post, sent as CSV so metrics can read them (rule 4: no made-up numbers).
export async function sendMetrics(formData: FormData) {
  const b = await requireBrand();
  const week = String(formData.get("week") ?? "").trim() || weekLabel();
  const names = formData.getAll("name").map(String);
  const col = (k: string) => formData.getAll(k).map((v) => String(v).trim());
  const dates = col("date"), channels = col("channel"), views = col("views"), likes = col("likes"), comments = col("comments"), saves = col("saves");
  const rows = names
    .map((name, i) => ({ name, date: dates[i] ?? "", channel: channels[i] ?? "threads", n: [views[i], likes[i], comments[i], saves[i]].map((v) => (v ?? "").replace(/[^\d]/g, "")) }))
    .filter((r) => r.n.some((v) => v !== ""));
  if (rows.length === 0) return;
  const csv = ["date,channel,post,views,likes,comments,saves", ...rows.map((r) => [r.date, r.channel, r.name, ...r.n].join(","))].join("\n");
  await order(b.id, `Chạy số liệu tuần ${week}.\n\nSố liệu sếp dán (lưu nguyên văn thành reports/${week}-raw.csv rồi giao metrics; ô trống là không có số):\n\n${csv}\n\nXong thì chép reports/${week}.md vào /mnt/session/outputs/${week}/ và báo cáo.`);
  redirect(`/reports?week=${week}`);
}

// A customer wrote under a post; the team drafts the answer, you send it yourself (rule 3).
export async function draftReply(formData: FormData) {
  const b = await requireBrand();
  const name = String(formData.get("name") ?? "");
  const comment = String(formData.get("comment") ?? "").trim().replace(/\s+/g, " ").slice(0, 600);
  if (!name || !comment) return;
  const post = await fileByName(b.id, name);
  if (!post) return;
  const week = post.week ?? weekLabel();
  const now = new Date();
  const stamp = `${now.toISOString().slice(0, 10)}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const file = `reply-${stamp}-${name.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, "").slice(0, 30)}.md`;
  await order(
    b.id,
    `Khách bình luận dưới bài ${name}: "${comment}"\n\nSoạn 1 câu trả lời, chỉ soạn không gửi (nội quy 3). writer viết file content/replies/${file} với front matter status: draft, post: ${name}, week: ${week}; phần thân gồm "## Bình luận" (chép nguyên văn) rồi "## Trả lời" (câu trả lời: đúng xưng hô và từ cấm trong brand/BRAND.md, tối đa 300 ký tự, không hứa hẹn, không bịa số liệu). qa kiểm giọng và từ cấm rồi đặt status: ready. Xong thì chép file vào /mnt/session/outputs/${week}/${file} và báo cáo.`,
  );
  redirect(`/drafts/${encodeURIComponent(name)}#tra-loi`);
}

// A new brand is a new office: its own session, budget and conversation. The team starts on the card at once.
export async function newBrand(formData: FormData) {
  await requireAuth();
  const sentence = String(formData.get("sentence") ?? "").trim();
  const budget = Math.min(200, Math.max(1, Number(formData.get("budget")) || 30));
  if (!sentence) return;
  const b = await createBrand(sentence, budget);
  await setCurrentBrand(b.id);
  await Promise.all([sync(b.id).catch(() => {}), officeStatus(b.id).catch(() => {})]);
  revalidatePath("/", "layout");
  redirect("/chat");
}

// The office stopped (budget reached or terminated): a new session on the same memory, same card, new budget.
export async function reopen(formData: FormData) {
  const b = await requireBrand();
  const budget = Math.min(200, Math.max(1, Number(formData.get("budget")) || 30));
  const nb = await reopenBrand(b, budget);
  await setCurrentBrand(nb.id);
  await Promise.all([sync(nb.id).catch(() => {}), officeStatus(nb.id).catch(() => {})]);
  revalidatePath("/", "layout");
  redirect("/chat");
}

// The boss writes a lesson straight into memory, no chat: this brand's bai-hoc.md or the shared quyet-dinh.md.
export async function addLesson(formData: FormData) {
  const b = await requireBrand();
  const text = String(formData.get("text") ?? "").trim().slice(0, 300);
  const shared = formData.get("scope") === "sep";
  const store = shared ? memoryStoreId() : b.memoryStoreId;
  if (!text || !store) return;
  await addLine(store, shared ? "/quyet-dinh.md" : "/bai-hoc.md", bossLine(text));
  revalidatePath("/brand");
  redirect(shared ? "/brand#so-thich" : "/brand#doi-da-hoc");
}

// Deleting a line is how a wrong lesson is unlearned; the team no longer sees it from the next cycle.
export async function forgetLine(formData: FormData) {
  const b = await requireBrand();
  const store = String(formData.get("store") ?? "");
  const path = String(formData.get("path") ?? "");
  const text = String(formData.get("text") ?? "");
  const shared = store === memoryStoreId();
  const allowed = (shared && SEP_FILES.some(([p]) => p === path)) || (store === b.memoryStoreId && BRAND_FILES.some(([p]) => p === path));
  if (!store || !text || !allowed) return;
  await removeLine(store, path, text);
  revalidatePath("/brand");
}

export async function switchBrand(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!(await allBrands()).some((b) => b.id === id)) return;
  await setCurrentBrand(id);
  // Its team may have delivered while you were on another brand.
  await sync(id).catch(() => {});
  revalidatePath("/", "layout");
  redirect("/");
}

// A plain-language change to the brand card, e.g. "đổi lịch đăng thành thứ 3, 5".
export async function askBrand(formData: FormData) {
  const b = await requireBrand();
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return;
  await order(b.id, `Sửa thẻ thương hiệu (brand/BRAND.md) theo yêu cầu sau, giữ nguyên phần còn lại, rồi chép lại vào /mnt/session/outputs/BRAND.md và báo cáo: ${text}`);
  redirect("/chat");
}

export async function decide(formData: FormData) {
  const b = await requireBrand();
  const name = String(formData.get("name") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!name || !["approved", "rejected"].includes(decision)) return;
  const db = await getDb();
  await db.insert(decisions).values({ brand: b.id, fileName: name, decision, note: note || null });
  // The approve/reject protocol is the lead's; it stays as written in agents/lead.md.
  await order(b.id, decision === "approved" ? `approve content/drafts/${name}` : `reject content/drafts/${name}: ${note || "không có ghi chú"}`);
  // Straight on to the next post waiting, if there is one.
  const next = (await currentFiles(b.id, "draft")).find((d) => d.status === "ready" && d.name !== name);
  redirect(next ? `/drafts/${encodeURIComponent(next.name)}` : "/drafts");
}

// The boss posted an approved draft themselves; only this page needs to know.
export async function markPosted(formData: FormData) {
  const b = await requireBrand();
  const name = String(formData.get("name") ?? "");
  if (!name) return;
  const db = await getDb();
  await db.insert(decisions).values({ brand: b.id, fileName: name, decision: "posted", note: null });
  revalidatePath("/", "layout");
}

// Asks the writer for one more draft from a research topic that did not become a post.
export async function writeTopic(formData: FormData) {
  const b = await requireBrand();
  const week = String(formData.get("week") ?? "").trim();
  const n = String(formData.get("n") ?? "").trim();
  if (!week || !n) return;
  await order(b.id, `Viết thêm 1 bài từ chủ đề ${n} trong research/${week}-topics.md: writer viết nháp, qa kiểm, rồi chép vào /mnt/session/outputs/${week}/ và báo cáo.`);
  redirect("/chat");
}

export async function sendMessage(formData: FormData) {
  const b = await requireBrand();
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return;
  await order(b.id, text);
}

export async function refresh() {
  const b = await requireBrand();
  await sync(b.id);
  revalidatePath("/", "layout");
}

export async function loginAction(formData: FormData) {
  const ok = await login(String(formData.get("password") ?? ""));
  if (!ok) redirect("/login?bad=1");
  redirect("/");
}
