import { requireAuth } from "@/lib/auth";
import { officeStatus, weekLabel } from "@/lib/office";
import { sync, currentFiles, teamState, lastStopReason } from "@/lib/sync";
import { Poller } from "@/components/Poller";
import OfficeScene from "@/components/OfficeScene";

export const dynamic = "force-dynamic";

export default async function Office() {
  await requireAuth();
  await sync().catch(() => {});
  const [status, team, drafts, stopReason] = await Promise.all([officeStatus(), teamState(), currentFiles("draft"), lastStopReason()]);
  const waiting = drafts.filter((d) => d.status === "ready").length;
  const week = weekLabel();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">Văn phòng</h1>
          <span className="chip bg-zinc-100 text-zinc-700">tuần {week}</span>
        </div>
        <Poller initial={{ ...status, stopReason }} />
      </div>
      <OfficeScene team={team.map((t) => ({ ...t, since: t.since ? t.since.toISOString() : null }))} waiting={waiting} week={week} />
    </div>
  );
}
