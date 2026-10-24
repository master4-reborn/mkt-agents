import { requireAuth } from "@/lib/auth";
import { sync, currentFiles } from "@/lib/sync";
import { FileList } from "@/components/FileList";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAuth();
  await sync().catch(() => {});
  const rows = await currentFiles("report");
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Báo cáo</h1>
      <FileList rows={rows} base="/reports" empty="Chưa có file nào." />
    </div>
  );
}
