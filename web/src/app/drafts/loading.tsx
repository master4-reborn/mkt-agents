import { Bone, CardBones, TabBones } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-3.5" aria-busy="true">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Bài viết</h1>
        <Bone w={110} h={10} />
      </div>
      <TabBones n={3} />
      <CardBones lines={3} />
      <CardBones lines={2} />
    </div>
  );
}
