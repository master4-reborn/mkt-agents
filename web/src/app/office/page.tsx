import { requireBrand } from "@/lib/brands";
import { knownStatus, weekLabel } from "@/lib/office";
import { currentFiles, teamState, lastStopReason } from "@/lib/sync";
import { weekNo } from "@/lib/parse";
import { StatusHeader } from "@/components/StatusHeader";
import { CatAvatar } from "@/components/CatAvatar";
import OfficeScene from "@/components/OfficeScene";

export const dynamic = "force-dynamic";

export default async function Office() {
  const { id: sid } = await requireBrand();
  const [status, team, drafts, stopReason] = await Promise.all([knownStatus(sid), teamState(sid), currentFiles(sid, "draft"), lastStopReason(sid)]);
  const waiting = drafts.filter((d) => d.status === "ready").length;
  const week = weekLabel();
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2.5">
        <CatAvatar size={36} />
        <StatusHeader title="Văn phòng" s={{ ...status, stopReason }} week={weekNo(week)} />
      </header>
      <OfficeScene team={team.map((t) => ({ ...t, since: t.since ? t.since.toISOString() : null }))} waiting={waiting} week={week} />
    </div>
  );
}
