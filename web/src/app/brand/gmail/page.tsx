import Link from "next/link";
import { requireBrand } from "@/lib/brands";
import { attachState, brandGmail, connection, publicUrl } from "@/lib/connections";
import { recentMirrors } from "@/lib/mirror";
import { mailNews } from "@/lib/mailbox";
import { currentFiles } from "@/lib/sync";
import { brandName } from "@/lib/parse";
import { shortSentence } from "@/lib/brands";
import { SubmitButton } from "@/components/SubmitButton";
import { IconBack, IconExternal, IconMail } from "@/components/Icons";
import { connectGmail, disconnectGmail, retryAttach, setGmailCopy, setGmailRead } from "../../actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  khoa: "Gmail không nhận địa chỉ hoặc mật khẩu ứng dụng này. Mật khẩu ứng dụng có 16 chữ cái, tạo trong tài khoản Google sau khi bật xác minh 2 bước; dán cả 16 chữ, có dấu cách cũng được.",
  nhan: "Không thấy nhãn này trong Gmail. Gõ đúng tên nhãn như trong Gmail, hoặc gõ Hộp thư đến.",
};

export default async function GmailPage({ searchParams }: { searchParams: Promise<{ loi?: string }> }) {
  const me = await requireBrand();
  const { loi } = await searchParams;
  const [gmail, state, recent, cards, news] = await Promise.all([connection("gmail"), attachState(me.id), recentMirrors(me.id, 5, "gmail"), currentFiles(me.id, "brand"), mailNews(me.id)]);
  const { label, copy } = brandGmail(me);
  const name = (cards[0] && brandName(cards[0].content)) || shortSentence(me.sentence);
  const error = loi ? ERRORS[loi] : null;
  const labels = ((gmail?.meta.labels as string[] | undefined) ?? []).slice(0, 12);
  const date = (d: Date) => d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  const time = (d: Date) => d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const shown = (l: string) => (l === "INBOX" ? "Hộp thư đến" : l);

  return (
    <div className="flex flex-col gap-3.5">
      <Link href="/brand#nguon" className="inline-flex items-center gap-0.5 self-start text-sm font-semibold text-accent-deep"><IconBack size={18} />Thương hiệu</Link>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] border border-line bg-card text-accent-deep"><IconMail size={24} /></span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="text-xl font-bold">Gmail</h1>
          <div className="text-xs text-muted">Đội đọc thư theo nhãn · Bản sao bài đã duyệt về hộp thư của bạn</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {!gmail && <span className="chip chip-outline">Chưa kết nối</span>}
        {!gmail && <span className="chip chip-accent">Khoảng 3 phút</span>}
        {gmail && gmail.status === "ok" && <span className="chip chip-ok">Đã kết nối · {date(gmail.connectedAt)}</span>}
        {gmail && gmail.status === "error" && <span className="chip chip-bad">Lỗi, dán lại mật khẩu</span>}
        {gmail && state === "ok" && <span className="chip chip-ok"><span className="inline-block h-1.5 w-1.5 rounded-full bg-ok-deep" />Đội đã có Gmail</span>}
        {gmail && state === "pending" && <span className="chip chip-warn"><span className="pulse inline-block h-1.5 w-1.5 rounded-full bg-warn" />Sẽ gắn khi đội rảnh</span>}
        {gmail && state.startsWith("error") && <span className="chip chip-bad">Chưa gắn được cho đội</span>}
      </div>

      {error && <div className="rounded-[18px] bg-bad-soft px-4 py-3 text-[13px] leading-relaxed text-bad">{error}</div>}

      {!gmail && (
        <>
          <section className="overflow-hidden rounded-[18px] border border-line bg-card">
            <div className="px-4 pb-2.5 pt-3.5 text-[15px] font-bold">Ba bước trong tài khoản Google</div>
            <Step n={1} title="Bật xác minh 2 bước" body="Google chỉ cho tạo mật khẩu ứng dụng khi tài khoản đã bật xác minh 2 bước.">
              <a href="https://myaccount.google.com/signinoptions/two-step-verification" target="_blank" rel="noreferrer" className="btn btn-xs btn-outline self-start">Mở xác minh 2 bước <IconExternal /></a>
            </Step>
            <Step n={2} title="Tạo mật khẩu ứng dụng" body="Đặt tên là Đội AI, bấm Tạo, chép 16 chữ cái hiện ra. Mật khẩu này chỉ dùng cho đội; đổi mật khẩu Google của bạn không ảnh hưởng.">
              <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="btn btn-xs btn-outline self-start">Mở mật khẩu ứng dụng <IconExternal /></a>
            </Step>
            <Step n={3} title="Tạo nhãn trong Gmail" body="Ví dụ nhãn Đội AI, rồi gắn nhãn cho những thư bạn muốn đội đọc. Hoặc cho đội đọc thẳng Hộp thư đến." />
          </section>
          <KeyForm title="Địa chỉ và mật khẩu ứng dụng" button="Kết nối" />
          <p className="px-1 text-xs leading-relaxed text-muted">Sau khi kết nối, bạn chọn nhãn để đội đọc và bật gửi bản sao bài cho từng thương hiệu.</p>
        </>
      )}

      {gmail && (
        <>
          {gmail.status === "error" && (
            <div className="flex flex-col gap-2 rounded-[18px] bg-bad-soft p-4 text-bad">
              <div className="text-sm font-bold">Gmail từ chối mật khẩu{gmail.checkedAt ? ` từ ${time(gmail.checkedAt)}` : ""}</div>
              <div className="text-[13px] leading-relaxed">{gmail.error}. Thường do mật khẩu ứng dụng bị xoá hoặc tài khoản tắt xác minh 2 bước. Tạo mật khẩu ứng dụng mới rồi dán vào đây.</div>
            </div>
          )}
          {state === "pending" && <div className="rounded-[18px] border-[1.5px] border-warn-line bg-warn-soft px-4 py-3 text-[13px] leading-relaxed text-warn"><b>Đội đang làm việc.</b> Gmail sẽ được gắn cho đội ngay khi đội rảnh, bạn không cần làm gì thêm.</div>}
          {state === "none" && !publicUrl() && <div className="rounded-[18px] border border-line bg-card px-4 py-3 text-[13px] leading-relaxed text-muted">Máy chủ này không có địa chỉ công khai nên đội chưa gọi được Gmail từ đây. Trên bản đã triển khai, đội được gắn tự động.</div>}
          {state.startsWith("error") && (
            <form action={retryAttach} className="flex flex-col gap-2 rounded-[18px] border-[1.5px] border-warn-line bg-warn-soft p-4 text-warn">
              <div className="text-[13px] leading-relaxed"><b>Chưa gắn được cho đội.</b> {state.slice(7)}</div>
              <SubmitButton className="btn btn-xs btn-warn self-start" pendingLabel="Đang gắn…">Gắn lại cho đội</SubmitButton>
            </form>
          )}

          <section className="overflow-hidden rounded-[18px] border border-line bg-card">
            <div className="row"><span className="row-label">Hộp thư</span><span className="min-w-0 flex-1 truncate text-sm">{gmail.label}</span></div>
            <div className="row"><span className="row-label">Kết nối từ</span><span className="text-sm">{time(gmail.connectedAt)}</span></div>
            <div className="row items-start">
              <form action={disconnectGmail} className="flex-none"><SubmitButton className="btn btn-xs btn-ghost" pendingLabel="Đang ngắt…">Ngắt kết nối</SubmitButton></form>
              <span className="text-xs leading-relaxed text-muted">Đội mất quyền đọc ngay. Thư đã gửi vẫn nằm trong hộp thư của bạn.</span>
            </div>
          </section>
          <details className="group">
            <summary className="cursor-pointer list-none text-sm font-semibold text-accent-deep">Dán mật khẩu mới</summary>
            <div className="pt-2"><KeyForm title="Địa chỉ và mật khẩu ứng dụng mới" button="Dán lại mật khẩu" address={gmail.label} /></div>
          </details>

          <div className="flex items-center justify-between gap-2 px-0.5">
            <div className="eyebrow">Cho thương hiệu này</div>
            <span className="chip chip-outline">{name}</span>
          </div>

          <section className="overflow-hidden rounded-[18px] border border-line bg-card">
            <div className="flex flex-col gap-2 p-4">
              <div className="text-sm font-semibold">Đọc nhãn</div>
              {label ? (
                <div className="flex items-center gap-2.5 rounded-[14px] border border-line bg-bg px-3 py-2.5">
                  <span className="flex-none text-accent-deep"><IconMail size={20} /></span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold">{shown(label)}</span>
                    <span className="text-xs text-muted">{news ? `${news.n} thư chưa đọc · đội tra khi bạn bấm Đọc thư ở Hôm nay, và khi nghiên cứu` : "Đội tra khi bạn bấm Đọc thư ở Hôm nay, và khi nghiên cứu"}</span>
                  </span>
                  <span className="chip chip-ok">Đọc được</span>
                </div>
              ) : (
                <div className="text-[13px] leading-relaxed text-muted">Gõ tên một nhãn trong Gmail. Thư mới dưới nhãn đó hiện ở Hôm nay với nút Đọc thư; đội đọc, tóm tắt, không trả lời.</div>
              )}
              <form action={setGmailRead} className="flex flex-col gap-2">
                <input name="label" list="gmail-labels" className="input" placeholder="Tên nhãn, ví dụ Đội AI" required autoComplete="off" />
                {labels.length > 0 && <datalist id="gmail-labels">{labels.map((l) => <option key={l} value={l === "INBOX" ? "Hộp thư đến" : l} />)}</datalist>}
                {labels.length > 0 && <div className="flex flex-wrap gap-1">{labels.map((l) => <span key={l} className="chip chip-outline">{shown(l)}</span>)}</div>}
                <SubmitButton className="btn btn-sm btn-dark self-start" pendingLabel="Đang kiểm tra…">{label ? "Đổi nhãn" : "Chọn nhãn"}</SubmitButton>
              </form>
              {label && (
                <form action={setGmailRead}>
                  <input type="hidden" name="clear" value="1" />
                  <SubmitButton className="btn btn-sm btn-ghost" pendingLabel="…">Thôi đọc</SubmitButton>
                </form>
              )}
            </div>
            <div className="flex flex-col gap-2 border-t border-line-soft p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">Gửi bản sao bài</div>
                <span className={`chip ${copy ? "chip-ok" : "chip-outline"}`}>{copy ? "Đang bật" : "Đang tắt"}</span>
              </div>
              <div className="text-[13px] leading-relaxed text-muted">Mỗi bài bạn duyệt được gửi một lần, từ {gmail.label} tới chính {gmail.label}. Không gửi cho ai khác.</div>
              <form action={setGmailCopy}>
                <input type="hidden" name="copy" value={copy ? "0" : "1"} />
                <SubmitButton className={`btn btn-sm ${copy ? "btn-ghost" : "btn-dark"} self-start`} pendingLabel={copy ? "Đang tắt…" : "Đang bật…"}>{copy ? "Tắt gửi bản sao" : "Bật gửi bản sao"}</SubmitButton>
              </form>
            </div>
            {copy && (
              <div className="flex flex-col gap-2 border-t border-line-soft p-4">
                <div className="text-sm font-semibold">Lần gửi gần nhất</div>
                {recent.length === 0 && <div className="text-[13px] text-muted">Chưa có gì để gửi. Bài bạn duyệt sẽ tự về hộp thư.</div>}
                {recent.map((r) => (
                  <div key={r.id} className="flex items-center gap-2.5">
                    <span className={`inline-block h-2 w-2 flex-none rounded-full ${r.status === "ok" ? "bg-ok" : "bg-warn-line"}`} />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{time(r.createdAt)}{r.error ? ` · ${r.error}` : ""}</span>
                    {r.status === "ok" ? <span className="chip chip-ok">Đã gửi</span> : <span className="chip chip-warn">Sẽ thử lại</span>}
                  </div>
                ))}
              </div>
            )}
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

function KeyForm({ title, button, address }: { title: string; button: string; address?: string }) {
  return (
    <form action={connectGmail} className="card flex flex-col gap-2.5">
      <div className="text-sm font-semibold">{title}</div>
      <label htmlFor="address" className="sr-only">Địa chỉ Gmail</label>
      <input id="address" name="address" type="email" className="input" placeholder="ten@gmail.com" defaultValue={address} required autoComplete="email" />
      <label htmlFor="password" className="sr-only">Mật khẩu ứng dụng</label>
      <input id="password" name="password" type="password" className="input" placeholder="16 chữ cái của mật khẩu ứng dụng" required autoComplete="off" />
      <div className="text-xs leading-relaxed text-muted">Mã hoá rồi cất trong ứng dụng. Đội không bao giờ thấy mật khẩu, chỉ đọc được thư và không gửi được cho ai.</div>
      <SubmitButton className="btn btn-accent" pendingLabel="Đang thử đăng nhập…">{button}</SubmitButton>
    </form>
  );
}
