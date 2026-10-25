import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { cachedStatus, officeStatus } from "@/lib/office";
import { sync, lastStopReason } from "@/lib/sync";
import { allBrands, currentBrand } from "@/lib/brands";
import { retryPending } from "@/lib/connections";
import { pushMirrors } from "@/lib/mirror";

export const dynamic = "force-dynamic";

// Polled by the page: pulls the current brand's new files and messages and returns its status.
// The other brands' teams keep working while you look at this one, so their status is refreshed too,
// and their files pulled while they work and once more when they stop.
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await currentBrand();
  if (!b) return NextResponse.json({ status: "none", listCostUsd: 0, budgetUsd: null, stopReason: null });
  const others = (await allBrands()).filter((x) => x.id !== b.id);
  await Promise.all([
    sync(b.id).catch(() => {}),
    ...others.map(async (o) => {
      const was = (await cachedStatus(o.id))?.status;
      const now = await officeStatus(o.id).catch(() => null);
      if (now?.status === "running" || was === "running") {
        await sync(o.id).catch(() => {});
        if (now?.status !== "running") await pushMirrors(o.id).catch(() => {});
      }
    }),
  ]);
  // Phase 5: copies of new deliveries go to the boss's Notion, and an office whose team was busy gets the endpoint now.
  await Promise.all([pushMirrors(b.id).catch(() => {}), retryPending().catch(() => {})]);
  const s = await officeStatus(b.id);
  return NextResponse.json({ ...s, stopReason: await lastStopReason(b.id) });
}
