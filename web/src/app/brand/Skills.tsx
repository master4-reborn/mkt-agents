import Link from "next/link";
import { SubmitButton } from "@/components/SubmitButton";
import { IconChevron, IconSearch } from "@/components/Icons";
import { EMPLOYEE_LABEL, SCHEDULE_LABEL, getSchedule, lastRun, monthSpendCents, pendingProposals, reviewDoc, scopeSkills, SHARED, type Schedule } from "@/lib/skills";
import { findSkill, setSkillSchedule } from "../actions";

// One scope's skills on the Thương hiệu page: proposals waiting for the boss, the skills in use, the scout's button and its
// schedule. "Kỹ năng chung" sits under Sở thích của sếp, "Kỹ năng riêng" under Đội đã học.
export async function Skills({ scope }: { scope: string }) {
  const shared = scope === SHARED;
  const [all, pending, run, schedule, spent] = await Promise.all([scopeSkills(scope), pendingProposals([scope]), lastRun(scope), getSchedule(scope), monthSpendCents()]);
  const active = all.filter((s) => s.status === "active");
  const retired = all.filter((s) => s.status === "retired");
  const running = run?.status === "running";
  const day = (d: Date) => d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  return (
    <section id={shared ? "ky-nang-chung" : "ky-nang-rieng"} className="flex scroll-mt-4 flex-col gap-2">
      <h2 className="text-[15px] font-bold">{shared ? "Kỹ năng chung" : "Kỹ năng riêng"}</h2>
      <p className="text-[13px] leading-relaxed text-muted">
        {shared
          ? "Cách làm hay trinh sát tìm trên mạng, có nguồn. Bạn duyệt xong thì đội ở mọi thương hiệu dùng từ việc kế tiếp."
          : "Chỉ cho thương hiệu này, trinh sát đọc thẻ thương hiệu khi tìm. Trùng chủ đề với kỹ năng chung thì kỹ năng riêng thắng."}
      </p>
      <div className="overflow-hidden rounded-[18px] border border-line bg-card">
        {pending.map(({ v, s }) => {
          const rv = reviewDoc(v.review);
          return (
            <Link key={v.id} href={`/brand/skill/${v.id}`} className="row text-ink">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-semibold">{rv.title || s.title}</span>
                <span className="truncate text-xs text-muted">{s.current ? `Cập nhật bản ${s.current}` : "Kỹ năng mới"} · trinh sát đề xuất {day(v.createdAt)}</span>
              </span>
              <span className="chip chip-accent">Chờ duyệt</span>
              <IconChevron className="text-faint" />
            </Link>
          );
        })}
        {running && (
          <div className="row">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-semibold">Trinh sát đang tìm{run.focus ? `: ${run.focus}` : ""}</span>
              <span className="text-xs text-muted">Bắt đầu {run.createdAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} · khoảng 30 phút, xong sẽ hiện ở đây</span>
            </span>
            <span className="chip chip-warn">Đang chạy</span>
          </div>
        )}
        {run?.status === "failed" && pending.length === 0 && (
          <div className="row">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-semibold">Lần tìm {day(run.createdAt)} không ra kỹ năng</span>
              <span className="truncate text-xs text-muted">{run.error}</span>
            </span>
            <span className="chip chip-bad">Lỗi</span>
          </div>
        )}
        {active.map((s) => {
          const v = s.versions.find((x) => x.version === s.current);
          return (
            <Link key={s.id} href={`/brand/skill/${v?.id}`} className="row text-ink">
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-sm font-semibold">{s.title}</span>
                <span className="flex flex-wrap items-center gap-1">
                  {s.receivers.split(",").map((r) => <span key={r} className="chip chip-outline">{EMPLOYEE_LABEL[r] ?? r}</span>)}
                  <span className="text-xs text-muted">bản {s.current}{v?.decidedAt ? ` · từ ${day(v.decidedAt)}` : ""}</span>
                </span>
              </span>
              <span className="chip chip-ok">Đang dùng</span>
              <IconChevron className="text-faint" />
            </Link>
          );
        })}
        {active.length === 0 && pending.length === 0 && !running && <div className="row text-sm text-muted">Chưa có kỹ năng nào.</div>}
        {retired.length > 0 && (
          <details className="border-t border-line-soft px-4 py-3">
            <summary className="cursor-pointer text-[13px] font-semibold text-accent-deep">Đã ngừng dùng · {retired.length}</summary>
            <div className="mt-2 flex flex-col gap-1.5">
              {retired.map((s) => (
                <Link key={s.id} href={`/brand/skill/${s.versions.find((x) => x.version === s.current)?.id}`} className="text-sm text-ink">{s.title} <span className="text-xs text-muted">· bản {s.current}</span></Link>
              ))}
            </div>
          </details>
        )}
      </div>
      <form action={findSkill} className="flex flex-col gap-2">
        <input type="hidden" name="scope" value={scope} />
        <input name="focus" className="input" placeholder={shared ? "Muốn tìm gì? Bỏ trống để trinh sát tự chọn" : "Ví dụ: hook Threads cho đồ ăn vặt"} maxLength={200} autoComplete="off" disabled={running} />
        <SubmitButton className="btn btn-sm btn-dark" pendingLabel="Đang gửi trinh sát…" disabled={running}>
          <IconSearch size={16} /> {running ? "Trinh sát đang tìm" : "Tìm kỹ năng mới"}
        </SubmitButton>
        <div className="text-xs text-muted">Mỗi lần khoảng 2,6 USD, tối đa 4 USD. Một lần chỉ đề xuất một kỹ năng.</div>
      </form>
      <div className="flex flex-col gap-1.5">
        <div className="text-[13px] font-semibold">Tự tìm theo lịch</div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(SCHEDULE_LABEL) as Schedule[]).map((k) => (
            <form key={k} action={setSkillSchedule}>
              <input type="hidden" name="scope" value={scope} />
              <input type="hidden" name="value" value={k} />
              <button className={`chip ${k === schedule ? "chip-accent" : "chip-outline"} cursor-pointer`} aria-pressed={k === schedule}>{SCHEDULE_LABEL[k]}</button>
            </form>
          ))}
        </div>
        <div className="text-xs text-muted">
          {schedule === "off" ? "Chỉ tìm khi bạn bấm." : "Không tìm thêm khi còn đề xuất chờ bạn duyệt."} Tháng này trinh sát đã dùng {(spent / 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} trên 20 USD; chạm mức thì lịch tạm dừng, nút vẫn dùng được.
        </div>
      </div>
    </section>
  );
}
