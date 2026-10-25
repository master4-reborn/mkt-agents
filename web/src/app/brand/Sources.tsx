import Link from "next/link";
import { attachState, brandGmail, brandNotion, connection } from "@/lib/connections";
import type { Brand } from "@/lib/brands";
import { IconChevron, IconFile, IconFolder, IconGlobe, IconMail } from "@/components/Icons";

// Phase 5: where the team reads and where the app saves copies. Internet is always on; each storage is one row that opens
// its own page. Drive is a row already so the boss sees what is coming; Notion and Gmail work today.
export async function Sources({ me }: { me: Brand }) {
  const [notion, gmail, state] = await Promise.all([connection("notion"), connection("gmail"), attachState(me.id)]);
  const { read, save } = brandNotion(me);
  const { label: mailLabel, copy } = brandGmail(me);
  const chipFor = (c: typeof notion, bad: string): [string, string] => (!c ? ["chip-outline", "Chưa kết nối"] : c.status === "error" ? ["chip-bad", bad] : state === "pending" ? ["chip-warn", "Sẽ gắn khi đội rảnh"] : ["chip-ok", "Đã kết nối"]);
  const [cls, label] = chipFor(notion, "Lỗi, dán lại khoá");
  const [gcls, glabel] = chipFor(gmail, "Lỗi, dán lại mật khẩu");
  const sub = !notion ? "Đọc bảng của bạn · Lưu bài, báo cáo, thẻ" : [read ? `Đọc «${read.title}»` : "Chưa chọn bảng để đọc", save ? `Lưu vào «${save.title}»` : "Chưa chọn trang để lưu"].join(" · ");
  const gsub = !gmail ? "Đọc thư theo nhãn · gửi bản sao bài" : [mailLabel ? `Đọc nhãn «${mailLabel}»` : "Chưa chọn nhãn để đọc", copy ? "Gửi bản sao bài" : "Không gửi bản sao"].join(" · ");
  const icon = "flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-line-soft bg-bg text-accent-deep";
  return (
    <section id="nguon" className="overflow-hidden rounded-[18px] border border-line bg-card scroll-mt-4">
      <div className="flex flex-col gap-1 px-4 pb-3 pt-4">
        <div className="text-[15px] font-bold">Nguồn và lưu trữ</div>
        <div className="text-[13px] leading-relaxed text-muted">Đội đọc internet sẵn. Thêm Notion để đội đọc bảng của bạn và lưu bài đã duyệt, báo cáo tuần, thẻ thương hiệu vào đó. Thêm Gmail để đội đọc thư theo nhãn và gửi bản sao bài về hộp thư của bạn.</div>
      </div>
      <div className="row">
        <span className={icon}><IconGlobe /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5"><span className="text-sm font-semibold">Internet</span><span className="text-xs text-muted">Mặc định, luôn bật</span></span>
        <span className="chip chip-ok">Đang dùng</span>
      </div>
      <Link href="/brand/notion" className="row text-ink">
        <span className={icon}><IconFile /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5"><span className="text-sm font-semibold">Notion</span><span className="truncate text-xs text-muted">{sub}</span></span>
        <span className={`chip ${cls}`}>{label}</span>
        <IconChevron className="text-faint" />
      </Link>
      <Link href="/brand/gmail" className="row text-ink">
        <span className={icon}><IconMail /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5"><span className="text-sm font-semibold">Gmail</span><span className="truncate text-xs text-muted">{gsub}</span></span>
        <span className={`chip ${gcls}`}>{glabel}</span>
        <IconChevron className="text-faint" />
      </Link>
      <div className="row">
        <span className={icon}><IconFolder /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5"><span className="text-sm font-semibold">Drive</span><span className="text-xs text-muted">Chỉ đọc thư mục đã chia sẻ</span></span>
        <span className="chip chip-outline">Sắp có</span>
      </div>
      <div className="border-t border-line-soft px-4 py-3 text-xs leading-relaxed text-muted">Khoá được mã hoá, chỉ nằm trong ứng dụng. Đội chỉ đọc; bản sao do ứng dụng lưu sau khi bạn duyệt.</div>
    </section>
  );
}
