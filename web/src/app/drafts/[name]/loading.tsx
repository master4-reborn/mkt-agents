import { Bone, CardBones } from "@/components/Skeleton";

// Duyệt bài while it renders: the post card first, then the two explanation cards.
export default function Loading() {
  return (
    <div className="flex flex-col gap-3.5 pb-[150px] lg:pb-0" aria-busy="true">
      <div className="flex items-center gap-2.5">
        <Bone w={40} h={40} r={12} className="flex-none" />
        <Bone w={150} h={12} />
        <Bone w={96} h={26} r={999} className="ml-auto" />
      </div>
      <CardBones lines={5} />
      <div className="card flex flex-col gap-2.5">
        <Bone w={130} h={10} />
        <Bone h={12} />
        <Bone w="85%" h={12} />
        <Bone w="70%" h={34} r={10} />
      </div>
      <div className="card flex flex-col gap-2.5">
        <div className="flex justify-between"><Bone w={90} h={10} /><Bone w={50} h={10} /></div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2.5"><Bone w={20} h={20} r={999} className="flex-none" /><Bone w={`${60 + (i % 3) * 10}%`} h={12} /></div>
        ))}
      </div>
    </div>
  );
}
