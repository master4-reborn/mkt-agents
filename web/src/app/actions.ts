"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, decisions } from "@/lib/db";
import { say, weekLabel } from "@/lib/office";
import { requireAuth, login } from "@/lib/auth";
import { sync, currentFiles } from "@/lib/sync";

// Orders go to the lead in Vietnamese so it answers in Vietnamese (it mirrors the boss's language).
const WEEK_ORDER = (week: string, note: string) =>
  `Chạy tuần ${week}.\n\nLàm theo chu trình tuần: nghiên cứu, rồi viết 3 đến 5 bài, rồi QA, rồi chép các file của tuần vào /mnt/session/outputs/${week}/ và báo cáo.\n\nGhi chú của sếp cho tuần này: ${note || "không có"}`;

export async function runWeek(formData: FormData) {
  await requireAuth();
  const note = String(formData.get("note") ?? "").trim();
  await say(WEEK_ORDER(weekLabel(), note));
  revalidatePath("/");
}

export async function runMetrics(formData: FormData) {
  await requireAuth();
  const week = String(formData.get("week") ?? "").trim() || weekLabel();
  await say(`Chạy số liệu tuần ${week}. Xong thì chép reports/${week}.md vào /mnt/session/outputs/${week}/ và báo cáo.`);
  revalidatePath("/");
}

export async function newBrand(formData: FormData) {
  await requireAuth();
  const sentence = String(formData.get("sentence") ?? "").trim();
  if (!sentence) return;
  await say(`New brand: ${sentence}`);
  revalidatePath("/brand");
  redirect("/chat");
}

// A plain-language change to the brand card, e.g. "đổi lịch đăng thành thứ 3, 5".
export async function askBrand(formData: FormData) {
  await requireAuth();
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return;
  await say(`Sửa thẻ thương hiệu (brand/BRAND.md) theo yêu cầu sau, giữ nguyên phần còn lại, rồi chép lại vào /mnt/session/outputs/BRAND.md và báo cáo: ${text}`);
  revalidatePath("/brand");
  redirect("/chat");
}

export async function decide(formData: FormData) {
  await requireAuth();
  const name = String(formData.get("name") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!name || !["approved", "rejected"].includes(decision)) return;
  const db = await getDb();
  await db.insert(decisions).values({ fileName: name, decision, note: note || null });
  // The approve/reject protocol is the lead's; it stays as written in agents/lead.md.
  const order =
    decision === "approved"
      ? `approve content/drafts/${name}`
      : `reject content/drafts/${name}: ${note || "không có ghi chú"}`;
  await say(order);
  revalidatePath("/", "layout");
  // Straight on to the next post waiting, if there is one.
  const next = (await currentFiles("draft")).find((d) => d.status === "ready" && d.name !== name);
  redirect(next ? `/drafts/${encodeURIComponent(next.name)}` : "/drafts");
}

// The boss posted an approved draft themselves; only this page needs to know.
export async function markPosted(formData: FormData) {
  await requireAuth();
  const name = String(formData.get("name") ?? "");
  if (!name) return;
  const db = await getDb();
  await db.insert(decisions).values({ fileName: name, decision: "posted", note: null });
  revalidatePath("/", "layout");
}

// Asks the writer for one more draft from a research topic that did not become a post.
export async function writeTopic(formData: FormData) {
  await requireAuth();
  const week = String(formData.get("week") ?? "").trim();
  const n = String(formData.get("n") ?? "").trim();
  if (!week || !n) return;
  await say(`Viết thêm 1 bài từ chủ đề ${n} trong research/${week}-topics.md: writer viết nháp, qa kiểm, rồi chép vào /mnt/session/outputs/${week}/ và báo cáo.`);
  redirect("/chat");
}

export async function sendMessage(formData: FormData) {
  await requireAuth();
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return;
  await say(text);
  revalidatePath("/chat");
}

export async function refresh() {
  await requireAuth();
  await sync();
  revalidatePath("/", "layout");
}

export async function loginAction(formData: FormData) {
  const ok = await login(String(formData.get("password") ?? ""));
  if (!ok) redirect("/login?bad=1");
  redirect("/");
}
