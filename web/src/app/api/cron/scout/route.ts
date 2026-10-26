import { NextResponse } from "next/server";
import { isNotNull } from "drizzle-orm";
import { getDb, brands } from "@/lib/db";
import { collectScoutRuns, notDue, startScout, SHARED } from "@/lib/skills";

export const dynamic = "force-dynamic";

// Vercel calls this every day at 02:00 UTC (vercel.json) with "Authorization: Bearer $CRON_SECRET". Each scope whose
// schedule is due gets one scout run; a scope still waiting on the boss's review, already running, or past the monthly
// ceiling is left alone (lib/skills.ts, notDue).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await collectScoutRuns().catch(() => {});
  const db = await getDb();
  const scopes = [SHARED, ...(await db.select({ id: brands.id }).from(brands).where(isNotNull(brands.memoryStoreId))).map((b) => b.id)];
  const result: Record<string, string> = {};
  for (const scope of scopes) {
    try {
      const why = await notDue(scope);
      result[scope] = why ?? `started ${await startScout(scope, "", "schedule")}`;
    } catch (e) {
      result[scope] = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return NextResponse.json({ result });
}
