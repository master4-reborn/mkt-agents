import { CatAvatar, EMPLOYEE_NAME } from "@/components/CatAvatar";
import { TEAM } from "@/lib/sync";
import { Bone, HeaderBones, HeroBones, RowBones } from "@/components/Skeleton";

// Hôm nay while it renders: same layout, data as bones, the cats real.
export default function Loading() {
  return (
    <div className="flex flex-col gap-5 lg:gap-6" aria-busy="true">
      <HeaderBones title="Đội AI" />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        <div aria-hidden className="hidden min-h-[520px] rounded-3xl bg-accent-soft lg:block" />
        <div className="flex min-w-0 flex-col gap-5">
          <HeroBones />
          <section className="flex flex-col gap-2.5">
            <h2 className="text-[15px] font-bold">Việc của bạn</h2>
            <RowBones n={3} />
          </section>
          <section className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between"><h2 className="text-[15px] font-bold">Tuần này</h2><Bone w={90} h={10} /></div>
            <div className="grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col items-center gap-2 rounded-[14px] border border-line bg-card px-2 py-2.5">
                  <Bone w={26} h={26} r={999} />
                  <Bone w={44 + (i % 2) * 10} h={9} />
                </div>
              ))}
            </div>
          </section>
          <section className="flex flex-col gap-2.5">
            <h2 className="text-[15px] font-bold">Đội</h2>
            <div className="grid grid-cols-5 gap-1.5 opacity-55">
              {TEAM.map((a) => (
                <div key={a} className="flex flex-col items-center gap-1">
                  <CatAvatar agent={a} size={44} />
                  <div className="text-center text-[11px] font-semibold">{EMPLOYEE_NAME[a]}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
