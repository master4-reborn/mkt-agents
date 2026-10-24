"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, decisions } from "@/lib/db";
import { say, weekLabel } from "@/lib/office";
import { requireAuth, login } from "@/lib/auth";
import { sync } from "@/lib/sync";

const WEEK_ORDER = (week: string, note: string) =>
  `Run week ${week}.\n\nFollow the weekly cycle: research, then writer (3 to 5 drafts), then qa, then copy the week's files to /mnt/session/outputs/${week}/ and report.\n\nBoss's note for this week: ${note || "none"}`;

export async function runWeek(formData: FormData) {
  await requireAuth();
  const note = String(formData.get("note") ?? "").trim();
  await say(WEEK_ORDER(weekLabel(), note));
  revalidatePath("/");
}

export async function runMetrics(formData: FormData) {
  await requireAuth();
  const week = String(formData.get("week") ?? "").trim() || weekLabel();
  await say(`Run metrics for ${week}. Then copy reports/${week}.md to /mnt/session/outputs/${week}/ and report.`);
  revalidatePath("/");
}

export async function newBrand(formData: FormData) {
  await requireAuth();
  const sentence = String(formData.get("sentence") ?? "").trim();
  if (!sentence) return;
  await say(`New brand: ${sentence}`);
  revalidatePath("/brand");
}

export async function updateBrand(formData: FormData) {
  await requireAuth();
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return;
  await say(
    `Replace /workspace/brand/BRAND.md with the file below, exactly as written (move the old one to archive/), copy it to /mnt/session/outputs/BRAND.md, then re-read it and tell me in three lines whether anything is still a placeholder.\n\n${content}`,
  );
  revalidatePath("/brand");
}

export async function decide(formData: FormData) {
  await requireAuth();
  const name = String(formData.get("name") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!name || !["approved", "rejected"].includes(decision)) return;
  const db = await getDb();
  await db.insert(decisions).values({ fileName: name, decision, note: note || null });
  const order =
    decision === "approved"
      ? `approve content/drafts/${name}`
      : `reject content/drafts/${name}: ${note || "không có ghi chú"}`;
  await say(order);
  revalidatePath("/drafts");
  revalidatePath(`/drafts/${name}`);
  redirect("/drafts");
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
