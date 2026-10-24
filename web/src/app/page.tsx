import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { officeStatus, weekLabel } from "@/lib/office";
import { sync, currentFiles, conversation, lastStopReason, teamState } from "@/lib/sync";
import { weekNo, parseReport } from "@/lib/parse";
import { userTasks, weekSteps, lastRun, hhmm, type Task, type Step } from "@/lib/home";
import { Poller } from "@/components/Poller";
import { CatAvatar, EMPLOYEE_NAME } from "@/components/CatAvatar";
import { CopyButton } from "@/components/CopyButton";
import { DesktopOnly } from "@/components/DesktopOnly";
import { IconCheck, IconChevron, IconPlay } from "@/components/Icons";
import OfficeScene from "@/components/OfficeScene";
import { runWeek, markPosted } from "./actions";

export const dynamic = "force-dynamic";

export default async function Home() {
  await requireAuth();
  await sync().catch(() => {});
  const week = weekLabel();
  const [status, drafts, research, convo, stopReason, team, brand] = await Promise.all([
    officeStatus(), currentFiles("draft"), currentFiles("research"), conversation(40), lastStopReason(), teamState(), currentFiles("brand"),
  ]);
  const files = [...drafts, ...research].map((f) => ({ name: f.name, kind: f.kind as "draft" | "research", title: f.title, week: f.week }));
  const waiting = drafts.filter((d) => d.status === "ready");
  const lastReport = [...convo].reverse().find((m) => m.role === "lead" && parseReport(m.text)) ?? null;
  const tasks = userTasks(drafts, lastReport, files);
  const working = new Set(team.filter((t) => t.state === "working").map((t) => t.agent));
  const steps = weekSteps(week, drafts, research, working);
  const run = lastRun(convo);
  const running = status.status === "running";
  const brandReady = brand[0]?.status === "ready";
  const n = weekNo(week);

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <header className="flex items-center gap-2.5">
        <CatAvatar size={36} />
        <Poller title="Đội AI" initial={{ ...status, stopReason }} week={n} />
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        <DesktopOnly>
          <section aria-label="Văn phòng 3D" className="hidden min-w-0 lg:block">
            <OfficeScene compact team={team.map((t) => ({ ...t, since: t.since ? t.since.toISOString() : null }))} waiting={waiting.length} week={week} />
          </section>
        </DesktopOnly>

        <div className="flex min-w-0 flex-col gap-5">
          <Hero waiting={waiting} running={running} brandReady={brandReady} finishedAt={run?.finishedAt ?? null} drafts={drafts.length} />

          {tasks.length > 0 && (
            <section className="flex flex-col gap-2.5">
              <h2 className="text-[15px] font-bold">Việc của bạn</h2>
              <div className="overflow-hidden rounded-2xl border border-line bg-card">
                {tasks.map((t, i) => <TaskRow key={i} task={t} />)}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-bold">Tuần {n}</h2>
              {run && <div className="text-xs text-muted">chạy lúc {hhmm(run.startedAt)}{run.finishedAt ? ` · ${Math.max(1, Math.round((run.finishedAt.getTime() - run.startedAt.getTime()) / 60000))} phút` : running ? " · đang chạy" : ""}</div>}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {steps.map((s) => <StepTile key={s.label} step={s} />)}
            </div>
          </section>

          <section className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-bold">Đội</h2>
              <Link href="/office" className="text-xs font-semibold text-accent-deep lg:hidden">Xem văn phòng 3D</Link>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {team.map((t) => {
                const inner = (
                  <>
                    <CatAvatar agent={t.agent} size={44} state={t.state} />
                    <div className={`text-center text-[11px] font-semibold ${t.state === "waiting" ? "text-muted" : ""}`}>{t.agent === "metrics" && t.state === "waiting" ? "Chờ số liệu" : EMPLOYEE_NAME[t.agent]}</div>
                  </>
                );
                return t.agent === "lead" ? (
                  <Link key={t.agent} href="/chat" className="flex flex-col items-center gap-1 text-ink">{inner}</Link>
                ) : (
                  <div key={t.agent} className="flex flex-col items-center gap-1">{inner}</div>
                );
              })}
            </div>
          </section>

          <form action={runWeek} className="flex flex-col gap-2">
            <button className="btn btn-outline w-full" disabled={running || !brandReady}>
              <IconPlay /> Chạy tuần mới <span className="font-medium text-muted">· 10 phút · 2 đến 3 USD</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Hero({ waiting, running, brandReady, finishedAt, drafts }: { waiting: { name: string; title: string }[]; running: boolean; brandReady: boolean; finishedAt: Date | null; drafts: number }) {
  if (!brandReady)
    return (
      <section className="flex flex-col gap-3 rounded-[20px] bg-accent-soft p-5">
        <div className="eyebrow text-accent-deep">Bắt đầu</div>
        <div className="text-[26px] font-bold leading-tight">Cho đội biết bạn bán gì</div>
        <div className="text-sm text-[#6b3d53]">Một câu là đủ: bán gì, cho ai, đăng kênh nào. Đội tự viết thẻ thương hiệu và hỏi lại bạn tối đa 3 câu.</div>
        <Link href="/brand" className="btn btn-accent">Tạo thương hiệu</Link>
      </section>
    );
  if (waiting.length > 0)
    return (
      <section className="flex flex-col gap-3 rounded-[20px] bg-accent-soft p-5">
        <div className="eyebrow text-accent-deep">Cần bạn ngay</div>
        <div className="text-[26px] font-bold leading-tight">{waiting.length} bài đang chờ bạn duyệt</div>
        <div className="text-sm text-[#6b3d53]">{finishedAt ? `Đội viết xong lúc ${hhmm(finishedAt)}. ` : ""}Đọc và quyết mất khoảng {Math.max(2, waiting.length * 2)} phút.</div>
        <Link href={`/drafts/${encodeURIComponent(waiting[0].name)}`} className="btn btn-accent">Duyệt ngay</Link>
      </section>
    );
  if (running)
    return (
      <section className="flex flex-col gap-3 rounded-[20px] bg-accent-soft p-5">
        <div className="eyebrow text-accent-deep">Đang chạy</div>
        <div className="text-[26px] font-bold leading-tight">Đội đang làm việc</div>
        <div className="text-sm text-[#6b3d53]">Trang này tự cập nhật. Bạn có thể đóng và quay lại sau.</div>
        <Link href="/chat" className="btn btn-dark">Xem trưởng nhóm đang nói gì</Link>
      </section>
    );
  return (
    <section className="flex flex-col gap-3 rounded-[20px] bg-accent-soft p-5">
      <div className="eyebrow text-accent-deep">Hôm nay</div>
      <div className="text-[26px] font-bold leading-tight">{drafts ? "Không còn bài nào chờ bạn" : "Chưa có bài nào"}</div>
      <div className="text-sm text-[#6b3d53]">{drafts ? "Việc của bạn ở dưới. Muốn thêm bài, chạy tuần mới." : "Chạy tuần mới để đội nghiên cứu và viết 3 đến 5 bài."}</div>
      <form action={runWeek}><button className="btn btn-accent w-full"><IconPlay /> Chạy tuần mới</button></form>
    </section>
  );
}

function TaskRow({ task }: { task: Task }) {
  const circle = <span className="h-[22px] w-[22px] flex-none rounded-full border-2 border-accent" aria-hidden />;
  if (task.kind === "post")
    return (
      <div className="flex items-center gap-3 border-b border-line-soft p-3.5 last:border-b-0">
        <form action={markPosted} className="flex">
          <input type="hidden" name="name" value={task.name} />
          <button className="group flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-accent text-transparent hover:bg-accent hover:text-white" aria-label="Đánh dấu đã đăng" title="Đã đăng rồi"><IconCheck size={12} /></button>
        </form>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="truncate text-sm font-semibold">Đăng “{task.title}” lên Threads</div>
          <div className="text-xs text-muted">Đã duyệt · bấm tròn khi đăng xong</div>
        </div>
        <CopyButton text={task.post} />
      </div>
    );
  if (task.kind === "fill")
    return (
      <Link href={`/drafts/${encodeURIComponent(task.name)}`} className="flex items-center gap-3 border-b border-line-soft p-3.5 text-ink last:border-b-0">
        {circle}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="text-sm font-semibold">Điền: {task.what}</div>
          <div className="truncate text-xs text-muted">Bài “{task.title}” còn một chỗ trống</div>
        </div>
        <IconChevron className="text-faint" />
      </Link>
    );
  return (
    <Link href="/chat" className="flex items-center gap-3 border-b border-line-soft p-3.5 text-ink last:border-b-0">
      {circle}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="clamp-2 text-sm font-semibold">{task.text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")}</div>
        <div className="text-xs text-muted">Trưởng nhóm nhắn</div>
      </div>
      <IconChevron className="text-faint" />
    </Link>
  );
}

function StepTile({ step }: { step: Step }) {
  const on = step.state === "partial" || step.state === "working";
  return (
    <div className={`flex flex-col items-center gap-1.5 rounded-[14px] border bg-card px-2 py-2.5 ${on ? "border-[1.5px] border-accent" : "border-line"}`}>
      {step.state === "done" ? (
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-ok-soft text-ok"><IconCheck size={14} /></span>
      ) : step.state === "working" ? (
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-accent-soft"><span className="h-2.5 w-2.5 rounded-full bg-[#e0a000] pulse" /></span>
      ) : step.state === "partial" ? (
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-accent-soft text-[11px] font-bold text-accent-deep">{step.detail}</span>
      ) : (
        <span className="h-[26px] w-[26px] rounded-full border-2 border-dashed border-line" />
      )}
      <div className={`text-center text-[11px] font-semibold leading-tight ${step.state === "todo" ? "text-muted" : on ? "text-accent-deep" : ""}`}>{step.label}</div>
    </div>
  );
}
