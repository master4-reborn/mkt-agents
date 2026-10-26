import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { allBrands } from "@/lib/brands";
import { SubmitButton } from "@/components/SubmitButton";
import { IconBack } from "@/components/Icons";
import { newBrand } from "../../actions";
import { ScoutPick } from "./ScoutPick";

export const dynamic = "force-dynamic";

// One sentence opens a new office: the team writes the brand card, finds competitors and asks back at most 3 questions.
export default async function NewBrand() {
  await requireAuth();
  const first = (await allBrands()).length === 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        {!first && <Link href="/brand" aria-label="Quay lại" className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-card text-ink"><IconBack /></Link>}
        <h1 className="text-2xl font-bold">{first ? "Thương hiệu đầu tiên" : "Thêm thương hiệu"}</h1>
      </div>
      <section className="flex flex-col gap-3 rounded-[20px] bg-accent-soft p-5">
        <div className="eyebrow text-accent-deep">Bắt đầu</div>
        <div className="text-[22px] font-bold leading-tight">Cho đội biết bạn bán gì</div>
        <div className="text-sm text-[#6b3d53]">Một câu: bán gì, cho ai, đăng kênh nào, xưng hô thế nào. Đội mở văn phòng mới, tự viết thẻ, tìm đối thủ và hỏi lại bạn tối đa 3 câu.</div>
        <form action={newBrand} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink-soft">Thương hiệu</span>
            <input name="sentence" className="input" placeholder="bán matcha cho dân văn phòng Hà Nội, đăng Threads, xưng mình/bạn" required autoFocus />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink-soft">Ngân sách cho thương hiệu này</span>
            <select name="budget" className="input" defaultValue="30">
              <option value="10">10 USD · khoảng 3 tuần</option>
              <option value="30">30 USD · khoảng 10 tuần</option>
              <option value="50">50 USD · khoảng 18 tuần</option>
            </select>
            <span className="text-xs text-[#6b3d53]">Mức trần, không phải tiền trả trước. Viết thẻ tốn khoảng 1 USD, mỗi tuần 2 đến 3 USD. Hết trần thì đội dừng.</span>
          </label>
          <ScoutPick />
          <SubmitButton className="btn btn-accent" pendingLabel="Đang mở văn phòng…">Mở văn phòng cho thương hiệu này</SubmitButton>
        </form>
      </section>
      {!first && <p className="text-[13px] leading-relaxed text-muted">Thương hiệu đang có không bị ảnh hưởng: mỗi thương hiệu có văn phòng, bài viết và ngân sách riêng. Bạn đổi qua lại bằng nút ở đầu mỗi trang.</p>}
    </div>
  );
}
