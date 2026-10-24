import { requireAuth } from "@/lib/auth";
import { sync, currentFiles } from "@/lib/sync";
import { FileList } from "@/components/FileList";

export const dynamic = "force-dynamic";

const GROUPS: [string, string[]][] = [
  ["Chờ bạn duyệt", ["ready"]],
  ["Đang sửa", ["needs-fix", "draft", "rejected"]],
  ["Đã duyệt", ["approved"]],
];

export default async function Drafts() {
  await requireAuth();
  await sync().catch(() => {});
  const drafts = await currentFiles("draft");
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Bài viết</h1>
      {GROUPS.map(([label, statuses]) => (
        <section key={label} className="space-y-2">
          <h2 className="font-medium">{label}</h2>
          <FileList rows={drafts.filter((d) => statuses.includes(d.status ?? ""))} base="/drafts" empty="Trống." />
        </section>
      ))}
    </div>
  );
}
