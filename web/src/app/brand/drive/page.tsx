import Link from "next/link";
import { requireBrand } from "@/lib/brands";
import { attachState, brandDrive, connection, publicUrl } from "@/lib/connections";
import { currentFiles } from "@/lib/sync";
import { brandName } from "@/lib/parse";
import { shortSentence } from "@/lib/brands";
import { SubmitButton } from "@/components/SubmitButton";
import { IconBack, IconExternal, IconFolder } from "@/components/Icons";
import { connectDrive, disconnectDrive, retryAttach, setDriveRead } from "../../actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  khoa: "Google không nhận khoá này. Dán nguyên nội dung tệp JSON tải về khi tạo khoá cho tài khoản dịch vụ, bắt đầu bằng dấu ngoặc nhọn.",
  api: "Khoá đúng nhưng dự án chưa bật Google Drive API. Bật trong Google Cloud rồi dán lại khoá.",
  thumuc: "Không mở được thư mục từ link này. Trong Drive, bấm Chia sẻ trên thư mục đó và thêm địa chỉ tài khoản dịch vụ ở trên, quyền Người xem.",
};

export default async function DrivePage({ searchParams }: { searchParams: Promise<{ loi?: string }> }) {
  const me = await requireBrand();
  const { loi } = await searchParams;
  const [drive, state, cards] = await Promise.all([connection("drive"), attachState(me.id), currentFiles(me.id, "brand")]);
  const folder = brandDrive(me);
  const name = (cards[0] && brandName(cards[0].content)) || shortSentence(me.sentence);
  const error = loi ? ERRORS[loi] : null;
  const date = (d: Date) => d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  const time = (d: Date) => d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col gap-3.5">
      <Link href="/brand#nguon" className="inline-flex items-center gap-0.5 self-start text-sm font-semibold text-accent-deep"><IconBack size={18} />Thương hiệu</Link>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] border border-line bg-card text-accent-deep"><IconFolder size={24} /></span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="text-xl font-bold">Drive</h1>
          <div className="text-xs text-muted">Đội đọc một thư mục bạn chia sẻ · Chỉ đọc</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {!drive && <span className="chip chip-outline">Chưa kết nối</span>}
        {!drive && <span className="chip chip-accent">Khoảng 5 phút</span>}
        {drive && drive.status === "ok" && <span className="chip chip-ok">Đã kết nối · {date(drive.connectedAt)}</span>}
        {drive && drive.status === "error" && <span className="chip chip-bad">Lỗi, dán lại khoá</span>}
        {drive && state === "ok" && <span className="chip chip-ok"><span className="inline-block h-1.5 w-1.5 rounded-full bg-ok-deep" />Đội đã có Drive</span>}
        {drive && state === "pending" && <span className="chip chip-warn"><span className="pulse inline-block h-1.5 w-1.5 rounded-full bg-warn" />Sẽ gắn khi đội rảnh</span>}
        {drive && state.startsWith("error") && <span className="chip chip-bad">Chưa gắn được cho đội</span>}
        <span className="chip chip-outline">Chỉ đọc</span>
      </div>

      {error && <div className="rounded-[18px] bg-bad-soft px-4 py-3 text-[13px] leading-relaxed text-bad">{error}</div>}

      {!drive && (
        <>
          <section className="overflow-hidden rounded-[18px] border border-line bg-card">
            <div className="px-4 pb-2.5 pt-3.5 text-[15px] font-bold">Ba bước trong Google Cloud</div>
            <Step n={1} title="Tạo tài khoản dịch vụ" body="Trong Google Cloud, chọn hoặc tạo một dự án, mở Tài khoản dịch vụ, tạo một tài khoản mới, tên gì cũng được.">
              <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noreferrer" className="btn btn-xs btn-outline self-start">Mở Tài khoản dịch vụ <IconExternal /></a>
            </Step>
            <Step n={2} title="Bật Google Drive API và tạo khoá" body="Bật Google Drive API cho dự án đó. Rồi trong tài khoản dịch vụ vừa tạo, mở Khoá, Thêm khoá, chọn JSON; một tệp được tải về.">
              <a href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noreferrer" className="btn btn-xs btn-outline self-start">Mở Google Drive API <IconExternal /></a>
            </Step>
            <Step n={3} title="Dán tệp JSON vào đây" body="Mở tệp bằng trình soạn thảo bất kỳ, chép toàn bộ, dán vào ô dưới. Sau đó bạn chia sẻ thư mục cho địa chỉ của tài khoản dịch vụ." />
          </section>
          <KeyForm label="Nội dung tệp JSON" button="Kết nối" />
          <p className="px-1 text-xs leading-relaxed text-muted">Tài khoản dịch vụ không có dung lượng Drive riêng nên đội chỉ đọc, không tạo hay sửa tệp. Bản sao bài vẫn được lưu vào Notion hoặc gửi qua Gmail.</p>
        </>
      )}

      {drive && (
        <>
          {drive.status === "error" && (
            <div className="flex flex-col gap-2 rounded-[18px] bg-bad-soft p-4 text-bad">
              <div className="text-sm font-bold">Google từ chối khoá{drive.checkedAt ? ` từ ${time(drive.checkedAt)}` : ""}</div>
              <div className="text-[13px] leading-relaxed">{drive.error}. Thường do khoá bị xoá trong Google Cloud. Tạo khoá JSON mới cho tài khoản dịch vụ rồi dán vào đây.</div>
            </div>
          )}
          {state === "pending" && <div className="rounded-[18px] border-[1.5px] border-warn-line bg-warn-soft px-4 py-3 text-[13px] leading-relaxed text-warn"><b>Đội đang làm việc.</b> Drive sẽ được gắn cho đội ngay khi đội rảnh, bạn không cần làm gì thêm.</div>}
          {state === "none" && !publicUrl() && <div className="rounded-[18px] border border-line bg-card px-4 py-3 text-[13px] leading-relaxed text-muted">Máy chủ này không có địa chỉ công khai nên đội chưa gọi được Drive từ đây. Trên bản đã triển khai, đội được gắn tự động.</div>}
          {state.startsWith("error") && (
            <form action={retryAttach} className="flex flex-col gap-2 rounded-[18px] border-[1.5px] border-warn-line bg-warn-soft p-4 text-warn">
              <div className="text-[13px] leading-relaxed"><b>Chưa gắn được cho đội.</b> {state.slice(7)}</div>
              <SubmitButton className="btn btn-xs btn-warn self-start" pendingLabel="Đang gắn…">Gắn lại cho đội</SubmitButton>
            </form>
          )}

          <section className="overflow-hidden rounded-[18px] border border-line bg-card">
            <div className="flex flex-col gap-1 p-4">
              <div className="text-sm font-semibold">Chia sẻ thư mục cho địa chỉ này</div>
              <code className="select-all break-all rounded-[10px] bg-bg px-3 py-2 text-[13px]">{drive.label}</code>
              <div className="text-xs leading-relaxed text-muted">Trong Drive, bấm Chia sẻ trên thư mục, dán địa chỉ, quyền Người xem. Đội chỉ thấy những gì bạn chia sẻ.</div>
            </div>
            <div className="row"><span className="row-label">Kết nối từ</span><span className="text-sm">{time(drive.connectedAt)}</span></div>
            <div className="row items-start">
              <form action={disconnectDrive} className="flex-none"><SubmitButton className="btn btn-xs btn-ghost" pendingLabel="Đang ngắt…">Ngắt kết nối</SubmitButton></form>
              <span className="text-xs leading-relaxed text-muted">Đội mất quyền đọc ngay. Thư mục của bạn không đổi.</span>
            </div>
          </section>
          <details className="group">
            <summary className="cursor-pointer list-none text-sm font-semibold text-accent-deep">Dán khoá mới</summary>
            <div className="pt-2"><KeyForm label="Nội dung tệp JSON mới" button="Dán lại khoá" /></div>
          </details>

          <div className="flex items-center justify-between gap-2 px-0.5">
            <div className="eyebrow">Cho thương hiệu này</div>
            <span className="chip chip-outline">{name}</span>
          </div>

          <section className="overflow-hidden rounded-[18px] border border-line bg-card">
            <div className="flex flex-col gap-2 p-4">
              <div className="text-sm font-semibold">Đọc thư mục</div>
              {folder ? (
                <div className="flex items-center gap-2.5 rounded-[14px] border border-line bg-bg px-3 py-2.5">
                  <span className="flex-none text-accent-deep"><IconFolder size={20} /></span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <a href={folder.url} target="_blank" rel="noreferrer" className="truncate text-sm font-semibold text-ink">{folder.name}</a>
                    <span className="text-xs text-muted">Thư mục · đội đọc Docs, Sheets, Slides và tệp chữ trong đó khi nghiên cứu</span>
                  </span>
                  <span className="chip chip-ok">Đọc được</span>
                </div>
              ) : (
                <div className="text-[13px] leading-relaxed text-muted">Dán link một thư mục đã chia sẻ cho địa chỉ ở trên. Đội đọc tài liệu thương hiệu, bài cũ, ghi chú khách hàng trong đó khi nghiên cứu.</div>
              )}
              <form action={setDriveRead} className="flex flex-col gap-2">
                <input name="link" className="input" placeholder="Dán link thư mục Drive" required autoComplete="off" />
                <SubmitButton className="btn btn-sm btn-dark self-start" pendingLabel="Đang kiểm tra…">{folder ? "Đổi thư mục" : "Chọn thư mục"}</SubmitButton>
              </form>
              {folder && (
                <form action={setDriveRead}>
                  <input type="hidden" name="clear" value="1" />
                  <SubmitButton className="btn btn-sm btn-ghost" pendingLabel="…">Thôi đọc</SubmitButton>
                </form>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Step({ n, title, body, children }: { n: number; title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-t border-line-soft px-4 py-3">
      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-accent-soft text-[13px] font-bold text-accent-deep">{n}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-[13px] leading-relaxed text-muted">{body}</div>
        {children}
      </div>
    </div>
  );
}

function KeyForm({ label, button }: { label: string; button: string }) {
  return (
    <form action={connectDrive} className="card flex flex-col gap-2.5">
      <label htmlFor="secret" className="text-sm font-semibold">{label}</label>
      <textarea id="secret" name="secret" rows={5} className="input resize-none font-mono text-[12px]" placeholder='{ "type": "service_account", … }' required autoComplete="off" spellCheck={false} />
      <div className="text-xs leading-relaxed text-muted">Mã hoá rồi cất trong ứng dụng. Đội không bao giờ thấy khoá, chỉ đọc được thư mục bạn chia sẻ.</div>
      <SubmitButton className="btn btn-accent" pendingLabel="Đang kiểm tra khoá…">{button}</SubmitButton>
    </form>
  );
}
