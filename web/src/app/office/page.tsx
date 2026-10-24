import { requireAuth } from "@/lib/auth";
import { officeStatus, weekLabel } from "@/lib/office";
import { sync, currentFiles, teamState, lastStopReason } from "@/lib/sync";
import { weekNo } from "@/lib/parse";
import { Poller } from "@/components/Poller";
import { CatAvatar } from "@/components/CatAvatar";
import OfficeScene from "@/components/OfficeScene";

export const dynamic = "force-dynamic";

export default async function Office() {
  await requireAuth();
  await sync().catch(() => {});
  const [status, team, drafts, stopReason] = await Promise.all([officeStatus(), teamState(), currentFiles("draft"), lastStopReason()]);
  const waiting = drafts.filter((d) => d.status === "ready").length;
  const week = weekLabel();
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2.5">
        <CatAvatar size={36} />
        <Poller title="Văn phòng" initial={{ ...status, stopReason }} week={weekNo(week)} />
      </header>
      <OfficeScene team={team.map((t) => ({ ...t, since: t.since ? t.since.toISOString() : null }))} waiting={waiting} week={week} />
    </div>
  );
}
