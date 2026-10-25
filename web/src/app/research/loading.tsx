import { Bone, TabBones } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-3.5" aria-busy="true">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Nghiên cứu</h1>
        <Bone w={120} h={10} />
      </div>
      <TabBones n={3} />
      <Bone w="90%" h={10} />
      {[0, 1, 2].map((i) => (
        <article key={i} className="flex gap-3 rounded-[18px] border border-line bg-card px-4 py-3.5">
          <Bone w={32} h={32} r={10} className="flex-none" />
          <div className="flex flex-1 flex-col gap-2">
            <Bone w={`${70 + (i % 2) * 15}%`} h={14} />
            <Bone w="90%" h={10} />
            <Bone w={120} h={22} r={999} />
          </div>
        </article>
      ))}
    </div>
  );
}
