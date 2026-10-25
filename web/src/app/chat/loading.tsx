import { CatAvatar } from "@/components/CatAvatar";
import { Bone } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-3.5 pb-[120px] lg:pb-0" aria-busy="true">
      <div className="flex items-center gap-2.5">
        <CatAvatar size={40} />
        <div className="flex flex-col gap-1.5">
          <div className="text-[17px] font-bold">Trưởng nhóm</div>
          <Bone w={150} h={10} />
        </div>
      </div>
      <Bone w={220} h={64} r={18} className="self-start" />
      <Bone w={200} h={56} r={18} className="self-end" soft />
      <Bone w={280} h={120} r={18} className="self-start" />
    </div>
  );
}
