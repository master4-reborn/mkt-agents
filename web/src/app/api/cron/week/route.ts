import { NextResponse } from "next/server";
import { and, eq, like, or } from "drizzle-orm";
import { getDb, brands, messages } from "@/lib/db";
import { say, weekLabel, weekOrder, officeStatus } from "@/lib/office";
import { sync } from "@/lib/sync";

export const dynamic = "force-dynamic";

// Vercel calls this every Monday at 01:00 UTC (08:00 Việt Nam; vercel.json) with "Authorization: Bearer $CRON_SECRET".
// Every brand that turned the schedule on gets the same "Chạy tuần mới" order the home button sends, once per week:
// a brand whose boss already ran this week, whose team is still busy, or whose office stopped is left alone.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = await getDb();
  const week = weekLabel();
  const due = await db.select().from(brands).where(eq(brands.schedule, "mon"));
  const result: Record<string, string> = {};
  for (const b of due) {
    try {
      // The home button sends "Chạy tuần <week>"; the first offices were ordered in English ("Run week <week>").
      const ran = await db.select({ id: messages.id }).from(messages).where(and(eq(messages.brand, b.id), eq(messages.role, "boss"), or(like(messages.text, `Chạy tuần ${week}%`), like(messages.text, `Run week ${week}%`)))).limit(1);
      if (ran.length) { result[b.id] = "already ran this week"; continue; }
      const s = await officeStatus(b.id);
      if (s.status === "running") { result[b.id] = "running"; continue; }
      if (s.status === "terminated" || (s.budgetUsd != null && s.listCostUsd >= s.budgetUsd)) { result[b.id] = "stopped"; continue; }
      await say(b.id, weekOrder(week, "", true));
      await Promise.all([sync(b.id).catch(() => {}), officeStatus(b.id).catch(() => {})]);
      result[b.id] = "sent";
    } catch (e) {
      result[b.id] = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return NextResponse.json({ week, result });
}
