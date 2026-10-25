import { Bone } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-3.5" aria-busy="true">
      <div className="flex items-center gap-3">
        <Bone w={52} h={52} r={16} className="flex-none" />
        <div className="flex flex-1 flex-col gap-2"><Bone w="55%" h={20} /><Bone w="40%" h={10} /></div>
        <Bone w={80} h={26} r={999} />
      </div>
      <Bone w="95%" h={10} />
      {[0, 1, 2].map((i) => (
        <section key={i} className="overflow-hidden rounded-[18px] border border-line bg-card">
          <div className="px-4 pb-1.5 pt-3"><Bone w={90} h={10} /></div>
          {[0, 1].map((j) => (
            <div key={j} className="row"><Bone w={96} h={10} className="flex-none" /><Bone w={`${55 + ((i + j) % 3) * 12}%`} h={12} /></div>
          ))}
        </section>
      ))}
    </div>
  );
}
