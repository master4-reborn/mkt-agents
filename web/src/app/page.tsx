import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { officeStatus, consoleUrl, weekLabel } from "@/lib/office";
import { sync, currentFiles, conversation, lastStopReason } from "@/lib/sync";
import { Poller } from "@/components/Poller";
import { Markdown } from "@/components/Markdown";
import { runWeek, runMetrics, refresh } from "./actions";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  await requireAuth();
  await sync().catch(() => {});
  const [status, drafts, convo, stopReason] = await Promise.all([officeStatus(), currentFiles("draft"), conversation(6), lastStopReason()]);
  const waiting = drafts.filter((d) => d.status === "ready");
  const lastLead = [...convo].reverse().find((m) => m.role === "lead");
  const brandReady = (await currentFiles("brand"))[0]?.status === "ready";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Tuần {weekLabel()}</h1>
        <Poller initial={{ ...status, stopReason }} />
      </div>

      {!brandReady && (
        <div className="card border-amber-300 bg-amber-50 text-sm">
          Chưa có thẻ thương hiệu. <Link href="/brand" className="underline">Tạo thương hiệu</Link> trước khi chạy tuần.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <form action={runWeek} className="card space-y-2">
          <div className="font-medium">Chạy tuần</div>
          <p className="text-sm text-zinc-600">Nghiên cứu → viết 3 đến 5 bài → QA. Khoảng 10 phút, 2 đến 3 USD.</p>
          <input name="note" className="input" placeholder="Ghi chú cho đội (tuỳ chọn)" />
          <button className="btn-primary w-full" disabled={status.status === "running"}>Chạy tuần này</button>
        </form>
        <form action={runMetrics} className="card space-y-2">
          <div className="font-medium">Chạy số liệu</div>
          <p className="text-sm text-zinc-600">Cần file CSV đã gửi vào reports/ qua trang Trò chuyện.</p>
          <input name="week" className="input" placeholder={`Tuần, mặc định ${weekLabel()}`} />
          <button className="btn-ghost w-full" disabled={status.status === "running"}>Chạy số liệu</button>
        </form>
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <div className="font-medium">Chờ bạn duyệt</div>
          <Link href="/drafts" className="text-sm underline">Tất cả bài</Link>
        </div>
        {waiting.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Không có bài nào chờ.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {waiting.map((d) => (
              <li key={d.name}>
                <Link href={`/drafts/${encodeURIComponent(d.name)}`} className="block rounded-md px-2 py-1.5 hover:bg-zinc-50">
                  {d.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <div className="font-medium">Trưởng nhóm nói</div>
          <form action={refresh}><button className="text-sm underline">Làm mới</button></form>
        </div>
        {lastLead ? <Markdown className="mt-2 text-sm">{lastLead.text}</Markdown> : <p className="mt-2 text-sm text-zinc-500">Chưa có gì.</p>}
      </div>

      <p className="text-xs text-zinc-400">
        <a href={consoleUrl()} target="_blank" rel="noreferrer" className="underline">Xem phiên làm việc trên Anthropic Console</a>
      </p>
    </div>
  );
}
