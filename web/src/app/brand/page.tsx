import { requireAuth } from "@/lib/auth";
import { sync, currentFiles } from "@/lib/sync";
import { parseFile } from "@/lib/parse";
import { Markdown } from "@/components/Markdown";
import { StatusChip } from "@/components/StatusChip";
import { newBrand, updateBrand } from "../actions";

export const dynamic = "force-dynamic";

export default async function Brand() {
  await requireAuth();
  await sync().catch(() => {});
  const brand = (await currentFiles("brand"))[0] ?? null;
  const p = brand ? parseFile(brand.name, brand.content) : null;
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Thương hiệu</h1>

      <form action={newBrand} className="card space-y-2">
        <div className="font-medium">{brand ? "Thương hiệu mới" : "Tạo thương hiệu"}</div>
        <p className="text-sm text-zinc-600">Một câu: bán gì, cho ai, đăng kênh nào. Đội tự viết thẻ, tìm đối thủ và hỏi lại bạn tối đa 3 câu.</p>
        <input name="sentence" className="input" placeholder="bán matcha cho dân văn phòng Hà Nội, đăng Threads, xưng mình/bạn" required />
        <button className="btn-primary">Gửi cho đội</button>
      </form>

      {brand && p && (
        <>
          <div className="card">
            <div className="flex items-center gap-2"><StatusChip status={brand.status} /><span className="text-xs text-zinc-500">cập nhật {brand.createdAt.toLocaleDateString("vi-VN")}</span></div>
            <Markdown className="mt-2 text-sm">{p.body}</Markdown>
          </div>
          <details className="card">
            <summary className="cursor-pointer text-sm font-medium">Sửa thẻ bằng tay</summary>
            <form action={updateBrand} className="mt-2 space-y-2">
              <textarea name="content" className="input font-mono text-xs" rows={24} defaultValue={brand.content} />
              <button className="btn-ghost">Gửi bản sửa</button>
            </form>
          </details>
        </>
      )}
    </div>
  );
}
