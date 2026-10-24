import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { sync, currentFiles } from "@/lib/sync";
import { weekNo, STATUS_LABEL } from "@/lib/parse";
import { IconChevron } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function Reports() {
  await requireAuth();
  await sync().catch(() => {});
  const rows = await currentFiles("report");
  return (
    <div className="flex flex-col gap-3.5">
      <h1 className="text-2xl font-bold">Báo cáo</h1>
      {rows.length === 0 ? (
        <div className="card flex flex-col gap-2 text-sm text-muted">
          <div className="text-[15px] font-bold text-ink">Chưa có báo cáo tuần</div>
          <p>Mỗi tuần, bạn dán số liệu (lượt xem, thích, bình luận của từng bài) vào ô nhắn trưởng nhóm. Đội so với tuần trước và nói bài nào nên lặp lại.</p>
          <Link href="/chat" className="btn btn-sm btn-soft self-start">Gửi số liệu cho đội</Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[18px] border border-line bg-card">
          {rows.map((r) => (
            <Link key={r.name} href={`/reports/${encodeURIComponent(r.name)}`} className="row text-ink first:border-t-0">
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="text-sm font-semibold">Tuần {weekNo(r.week)}</div>
                <div className="text-xs text-muted">{r.createdAt.toLocaleDateString("vi-VN")} · {STATUS_LABEL[r.status ?? ""] ?? r.status}</div>
              </div>
              <IconChevron className="text-faint" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
