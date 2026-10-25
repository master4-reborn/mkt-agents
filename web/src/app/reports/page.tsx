import Link from "next/link";
import { requireBrand } from "@/lib/brands";
import { currentFiles, conversation } from "@/lib/sync";
import { knownStatus } from "@/lib/office";
import { parseFile, weekNo, STATUS_LABEL } from "@/lib/parse";
import { SubmitButton } from "@/components/SubmitButton";
import { IconChevron } from "@/components/Icons";
import { sendMetrics } from "../actions";

export const dynamic = "force-dynamic";

// Where you tell the team how the posts did. One number per post is enough; the metrics employee
// compares with last week and says what to repeat. Nothing is fetched from Threads: the team cannot see it.
export default async function Reports({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { id: sid } = await requireBrand();
  const { week: wantWeek } = await searchParams;
  const [reports, drafts, convo, status] = await Promise.all([currentFiles(sid, "report"), currentFiles(sid, "draft"), conversation(sid, 6), knownStatus(sid)]);
  const out = drafts.filter((d) => (d.status === "posted" || d.status === "approved") && d.week);
  const weeks = [...new Set(out.map((d) => d.week!))].sort().reverse();
  const week = wantWeek && weeks.includes(wantWeek) ? wantWeek : weeks[0];
  const posts = out.filter((d) => d.week === week);
  const have = reports.find((r) => r.week === week);
  const lastBoss = [...convo].reverse().find((m) => m.role === "boss");
  const counting = status.status === "running" && !!lastBoss && /^Chạy số liệu/i.test(lastBoss.text);

  return (
    <div className="flex flex-col gap-3.5">
      <h1 className="text-2xl font-bold">Báo cáo</h1>

      {counting ? (
        <section aria-live="polite" className="flex flex-col gap-2 rounded-[20px] bg-accent-soft p-5">
          <div className="eyebrow text-accent-deep">Đang tính</div>
          <div className="text-[22px] font-bold leading-tight">Đội đang tính số liệu</div>
          <div className="text-sm text-[#6b3d53]">Khoảng 2 phút. Báo cáo sẽ hiện ở dưới, trang tự cập nhật.</div>
        </section>
      ) : posts.length === 0 ? (
        <div className="card flex flex-col gap-2 text-sm text-muted">
          <div className="text-[15px] font-bold text-ink">Chưa có bài đã đăng</div>
          <p>Khi bạn đăng một bài, bấm Đã đăng ở bài đó. Bài sẽ hiện ở đây để bạn điền lượt xem, thích, bình luận, lưu; đội so với tuần trước và nói bài nào nên lặp lại.</p>
          <Link href="/drafts?tab=da" className="btn btn-sm btn-soft self-start">Xem bài đã duyệt</Link>
        </div>
      ) : (
        <form action={sendMetrics} className="flex flex-col gap-3">
          <input type="hidden" name="week" value={week} />
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-[15px] font-bold">Số liệu tuần {weekNo(week)}</div>
            {have && <Link href={`/reports/${encodeURIComponent(have.name)}`} className="text-xs font-semibold text-accent-deep">Đã có báo cáo</Link>}
          </div>
          <p className="text-[13px] leading-relaxed text-muted">Mở Threads, chép số của từng bài vào đây. Ô nào không có thì bỏ trống, đội không đoán.</p>
          <div className="overflow-hidden rounded-[18px] border border-line bg-card">
            {posts.map((d) => {
              const p = parseFile(d.name, d.content);
              const posted = d.decision?.decision === "posted" ? d.decision.createdAt : d.createdAt;
              return (
                <div key={d.name} className="flex flex-col gap-2.5 border-b border-line-soft p-3.5 last:border-b-0">
                  <input type="hidden" name="name" value={d.name} />
                  <input type="hidden" name="date" value={posted.toISOString().slice(0, 10)} />
                  <input type="hidden" name="channel" value={String(p.data.channel ?? "threads").toLowerCase()} />
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="clamp-2 text-sm font-semibold">{d.title}</div>
                    <span className="flex-none text-[11px] text-muted">{d.status === "posted" ? `đăng ${posted.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}` : "đã duyệt, chưa bấm Đã đăng"}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[["views", "Xem"], ["likes", "Thích"], ["comments", "Bình luận"], ["saves", "Lưu"]].map(([k, label]) => (
                      <label key={k} className="flex flex-col gap-1">
                        <span className="text-[11px] font-semibold text-muted">{label}</span>
                        <input name={k} inputMode="numeric" pattern="[0-9]*" placeholder="–" className="input px-2 py-2 text-center text-sm" />
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <SubmitButton className="btn btn-accent w-full" pendingLabel="Đang gửi số liệu…">Gửi số liệu cho đội</SubmitButton>
          {weeks.length > 1 && (
            <div className="flex flex-wrap gap-1.5 text-xs">
              {weeks.map((w) => <Link key={w} href={`/reports?week=${w}`} className={`chip ${w === week ? "chip-dark" : "chip-outline"}`}>tuần {weekNo(w)}</Link>)}
            </div>
          )}
        </form>
      )}

      {reports.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[15px] font-bold">Báo cáo đã có</h2>
          <div className="overflow-hidden rounded-[18px] border border-line bg-card">
            {reports.map((r) => (
              <Link key={r.name} href={`/reports/${encodeURIComponent(r.name)}`} className="row text-ink first:border-t-0">
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="text-sm font-semibold">Tuần {weekNo(r.week)}</div>
                  <div className="text-xs text-muted">{r.createdAt.toLocaleDateString("vi-VN")} · {STATUS_LABEL[r.status ?? ""] ?? r.status}</div>
                </div>
                <IconChevron className="text-faint" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
