import Link from "next/link";
import { CatAvatar } from "./CatAvatar";
import { META, ORDER, STATE_COLOR, firstLines, type MapEmployee } from "./island-meta";

// Phone only: a window onto the island at the top of Hôm nay. The lead's latest line, who is busy, and the door in.
// On a wide screen the island itself sits beside the task list, so this stays hidden there.
export function IslandWindow({ team }: { team: MapEmployee[] }) {
  const lead = team.find((t) => t.agent === "lead");
  const busy = team.filter((t) => t.agent !== "lead" && t.state === "working");
  const line = lead?.state === "working" ? "Đang điều phối đội…" : firstLines(lead?.report ?? null, 2, 110) || "Chưa có báo cáo. Nhắn trưởng nhóm hoặc chạy tuần mới.";
  return (
    <Link href="/office" aria-label="Mở đảo văn phòng" className="relative flex flex-col gap-3 overflow-hidden rounded-[20px] border border-line p-4 text-ink no-underline lg:hidden" style={{ background: "linear-gradient(180deg,#ffe4ef 0%,#fff3f8 60%,#ffe9f2 100%)" }}>
      <div className="flex items-start gap-2.5">
        <CatAvatar size={34} />
        <div className="min-w-0 flex-1 rounded-[14px] rounded-tl-[4px] bg-ink px-3 py-2 text-[12.5px] leading-snug text-white">
          <span className="font-bold">Trưởng nhóm</span> · {line}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          {ORDER.map((a) => {
            const e = team.find((t) => t.agent === a);
            return <span key={a} title={META[a].name} className="inline-block h-7 w-7 rounded-full border-2" style={{ background: META[a].fur, borderColor: e?.state === "working" ? STATE_COLOR.working : "#fff" }} aria-hidden />;
          })}
        </div>
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-accent-deep">{busy.length ? `${busy.map((b) => META[b.agent].name).join(", ")} đang làm` : "Cả đội đang rảnh"}</span>
        <span className="chip chip-accent bg-accent text-white">Mở đảo ›</span>
      </div>
    </Link>
  );
}
