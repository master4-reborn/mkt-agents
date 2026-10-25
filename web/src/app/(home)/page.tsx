import Link from "next/link";
import { requireBrand } from "@/lib/brands";
import { knownStatus, weekLabel } from "@/lib/office";
import { currentFiles, conversation, lastStopReason, teamState } from "@/lib/sync";
import { weekNo, parseReport, parseFile, replyParts, fileRef } from "@/lib/parse";
import { userTasks, weekSteps, lastRun, hhmm, elapsedMinutes, type Task, type Step } from "@/lib/home";
import { StatusHeader } from "@/components/StatusHeader";
import { CatAvatar, EMPLOYEE_NAME } from "@/components/CatAvatar";
import { PostRow } from "@/components/PostRow";
import { SubmitButton } from "@/components/SubmitButton";
import { DesktopOnly } from "@/components/DesktopOnly";
import { IconCheck, IconChevron, IconPlay } from "@/components/Icons";
import OfficeScene from "@/components/OfficeScene";
import { IslandWindow } from "@/components/IslandWindow";
import { runWeek } from "../actions";
import { connection } from "@/lib/connections";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { id: sid } = await requireBrand();
  const week = weekLabel();
  const [status, drafts, research, convo, stopReason, team, brand, reports, replyFiles] = await Promise.all([
    knownStatus(sid), currentFiles(sid, "draft"), currentFiles(sid, "research"), conversation(sid, 40), lastStopReason(sid), teamState(sid), currentFiles(sid, "brand"), currentFiles(sid, "report"), currentFiles(sid, "reply"),
  ]);
  const files = [...drafts, ...research, ...reports, ...replyFiles].map(fileRef);
  const replies = replyFiles.map((r) => { const p = parseFile(r.name, r.content); return { post: String(p.data.post ?? ""), status: r.status, reply: replyParts(p.body).reply }; });
  const waiting = drafts.filter((d) => d.status === "ready");
  const lastReport = [...convo].reverse().find((m) => m.role === "lead" && parseReport(m.text)) ?? null;
  const notion = await connection("notion");
  const tasks: Task[] = [
    ...(notion?.status === "error" ? [{ kind: "key" as const, what: "Notion", error: notion.error ?? "lỗi", href: "/brand/notion" }] : []),
    ...userTasks(drafts, lastReport, files, reports, replies),
  ];
  const working = new Set(team.filter((t) => t.state === "working").map((t) => t.agent));
  const steps = weekSteps(week, drafts, research, working);
  const run = lastRun(convo);
  const running = status.status === "running";
  const brandReady = brand[0]?.status === "ready";
  const n = weekNo(week);
  const minutes = elapsedMinutes(run, running);

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <header className="flex items-center gap-2.5">
        <CatAvatar size={36} />
        <StatusHeader title="Đội AI" s={{ ...status, stopReason }} week={n} />
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        <DesktopOnly>
          <section aria-label="Văn phòng 3D" className="hidden min-w-0 lg:block">
            <OfficeScene compact team={team.map((t) => ({ ...t, since: t.since ? t.since.toISOString() : null }))} waiting={waiting.length} week={week} />
          </section>
        </DesktopOnly>

        <div className="flex min-w-0 flex-col gap-5">
          <IslandWindow team={team.map((t) => ({ ...t, since: t.since ? t.since.toISOString() : null }))} />
          <Hero waiting={waiting} running={running} brandReady={brandReady} finishedAt={run?.finishedAt ?? null} drafts={drafts.length} steps={steps} minutes={minutes} />

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
            <SubmitButton className="btn btn-outline w-full" pendingLabel="Đang gửi lệnh…" disabled={running || !brandReady}>
              {running ? `Đang chạy tuần ${n}, chờ xong mới chạy tiếp` : <><IconPlay /> Chạy tuần mới <span className="font-medium text-muted">· 10 phút · 2 đến 3 USD</span></>}
            </SubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}

function Hero({ waiting, running, brandReady, finishedAt, drafts, steps, minutes }: { waiting: { name: string; title: string }[]; running: boolean; brandReady: boolean; finishedAt: Date | null; drafts: number; steps: Step[]; minutes: number | null }) {
  if (!brandReady)
    return (
      <section className="flex flex-col gap-3 rounded-[20px] bg-accent-soft p-5">
        <div className="eyebrow text-accent-deep">Bắt đầu</div>
        <div className="text-[26px] font-bold leading-tight">{running ? "Đội đang viết thẻ thương hiệu" : "Thẻ thương hiệu chưa xong"}</div>
        <div className="text-sm text-[#6b3d53]">{running ? "Mất khoảng 3 phút. Trưởng nhóm sẽ hỏi lại bạn tối đa 3 câu trong trò chuyện." : "Trưởng nhóm đang chờ bạn trả lời vài câu về thương hiệu."}</div>
        <Link href="/chat" className="btn btn-accent">Xem trưởng nhóm</Link>
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
  if (running) {
    const current = steps.find((s) => s.state === "working");
    const title = current?.label.startsWith("Nghiên cứu") ? "Đội đang nghiên cứu" : current?.label.startsWith("Viết") ? "Đội đang viết bài" : current?.label.startsWith("QA") ? "QA đang soát bài" : "Đội đang làm việc";
    const done = steps.filter((s) => s.state === "done").length + (current ? 0.5 : 0);
    return (
      <section aria-live="polite" className="flex flex-col gap-3 rounded-[20px] bg-accent-soft p-5">
        <div className="eyebrow text-accent-deep">Đang chạy</div>
        <div className="text-[26px] font-bold leading-tight">{title}</div>
        {minutes != null && (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[13px] text-[#6b3d53]"><span>Phút {minutes} / khoảng 10</span><span>tự cập nhật mỗi 8 giây</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-[#ffc9dc]"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((done / steps.length) * 100)}%` }} /></div>
          </div>
        )}
        <div className="text-sm text-[#6b3d53]">{minutes == null ? "Trưởng nhóm đang trả lời bạn. " : ""}Bạn đóng trang được, xong việc sẽ hiện ở đây.</div>
        <Link href="/chat" className="btn btn-dark">Xem trưởng nhóm đang nói gì</Link>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-3 rounded-[20px] bg-accent-soft p-5">
      <div className="eyebrow text-accent-deep">Hôm nay</div>
      <div className="text-[26px] font-bold leading-tight">{drafts ? "Không còn bài nào chờ bạn" : "Chưa có bài nào"}</div>
      <div className="text-sm text-[#6b3d53]">{drafts ? "Việc của bạn ở dưới. Muốn thêm bài, chạy tuần mới." : "Chạy tuần mới để đội nghiên cứu và viết 3 đến 5 bài."}</div>
      <form action={runWeek}><SubmitButton className="btn btn-accent w-full" pendingLabel="Đang gửi lệnh…"><IconPlay /> Chạy tuần mới</SubmitButton></form>
    </section>
  );
}

function TaskRow({ task }: { task: Task }) {
  const circle = <span className="h-[22px] w-[22px] flex-none rounded-full border-2 border-accent" aria-hidden />;
  if (task.kind === "post") return <PostRow name={task.name} title={task.title} post={task.post} />;
  if (task.kind === "key")
    return (
      <Link href={task.href} className="flex items-center gap-3 border-b border-line-soft p-3.5 text-ink last:border-b-0">
        <span className="h-[22px] w-[22px] flex-none rounded-full border-2 border-bad" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="text-sm font-semibold">Kết nối {task.what} lỗi</div>
          <div className="truncate text-xs text-muted">{task.error} · đội tạm không đọc {task.what}</div>
        </div>
        <span className="chip chip-bad flex-none">Dán lại khoá</span>
      </Link>
    );
  if (task.kind === "reply")
    return (
      <Link href={`/drafts/${encodeURIComponent(task.name)}#tra-loi`} className="flex items-center gap-3 border-b border-line-soft p-3.5 text-ink last:border-b-0">
        {circle}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="truncate text-sm font-semibold">Trả lời khách dưới “{task.title}”</div>
          <div className="truncate text-xs text-muted">{task.reply}</div>
        </div>
        <IconChevron className="text-faint" />
      </Link>
    );
  if (task.kind === "metrics")
    return (
      <Link href={`/reports?week=${task.week}`} className="flex items-center gap-3 border-b border-line-soft p-3.5 text-ink last:border-b-0">
        {circle}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="text-sm font-semibold">Gửi số liệu tuần {weekNo(task.week)}</div>
          <div className="truncate text-xs text-muted">{task.posts} bài đã đăng · đội sẽ nói bài nào nên lặp lại</div>
        </div>
        <IconChevron className="text-faint" />
      </Link>
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
