import { requireBrand } from "@/lib/brands";
import { knownStatus, weekLabel } from "@/lib/office";
import { currentFiles, teamState } from "@/lib/sync";
import OfficeScene from "@/components/OfficeScene";

export const dynamic = "force-dynamic";

export default async function Office() {
  const { id: sid } = await requireBrand();
  const [team, drafts, status] = await Promise.all([teamState(sid), currentFiles(sid, "draft"), knownStatus(sid).catch(() => null)]);
  const waiting = drafts.filter((d) => d.status === "ready").length;
  // The island takes the whole window under the app's nav; the page itself has nothing else to show.
  return <OfficeScene team={team.map((t) => ({ ...t, since: t.since ? t.since.toISOString() : null }))} waiting={waiting} week={weekLabel()} running={status?.status === "running"} full />;
}
