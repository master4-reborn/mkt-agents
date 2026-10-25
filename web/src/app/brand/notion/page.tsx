import Link from "next/link";
import { requireBrand } from "@/lib/brands";
import { attachState, brandNotion, connection, publicUrl } from "@/lib/connections";
import { recentMirrors } from "@/lib/mirror";
import { currentFiles } from "@/lib/sync";
import { brandName } from "@/lib/parse";
import { shortSentence } from "@/lib/brands";
import { SubmitButton } from "@/components/SubmitButton";
import { IconBack, IconExternal, IconFile, IconTable } from "@/components/Icons";
import { connectNotion, disconnectNotion, retryAttach, setNotionRead, setNotionSave } from "../../actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  khoa: "Notion không nhận khoá này. Khoá bắt đầu bằng ntn_, chép từ trang tích hợp; dán lại cả dòng.",
  doc: "Không đọc được bảng từ link này. Trong Notion, mở bảng đó, bấm dấu ba chấm, chọn Kết nối rồi chọn tích hợp của đội.",
  luu: "Không mở được trang từ link này. Trang phải được kết nối với tích hợp của đội trong Notion.",
  bang: "Mở được trang nhưng không tạo được bảng trong đó. Tích hợp cần quyền chèn nội dung; bật rồi thử lại.",
};

export default async function NotionPage({ searchParams }: { searchParams: Promise<{ loi?: string }> }) {
  const me = await requireBrand();
  const { loi } = await searchParams;
  const [notion, state, recent, cards] = await Promise.all([connection("notion"), attachState(me.id), recentMirrors(me.id), currentFiles(me.id, "brand")]);
  const { read, save } = brandNotion(me);
  const name = (cards[0] && brandName(cards[0].content)) || shortSentence(me.sentence);
  const error = loi ? ERRORS[loi] : null;
  const dbs = save ? (notion?.meta.dbs?.[save.pageId] as { posts?: unknown; reports?: unknown; cards?: unknown } | undefined) : undefined;
  const date = (d: Date) => d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  const time = (d: Date) => d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col gap-3.5">
      <Link href="/brand#nguon" className="inline-flex items-center gap-0.5 self-start text-sm font-semibold text-accent-deep"><IconBack size={18} />Thương hiệu</Link>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] border border-line bg-card text-accent-deep"><IconFile size={24} /></span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="text-xl font-bold">Notion</h1>
          <div className="text-xs text-muted">Đọc bảng của bạn · Lưu bài đã duyệt, báo cáo tuần, thẻ</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {!notion && <span className="chip chip-outline">Chưa kết nối</span>}
        {!notion && <span className="chip chip-accent">Khoảng 4 phút</span>}
        {notion && notion.status === "ok" && <span className="chip chip-ok">Đã kết nối · {date(notion.connectedAt)}</span>}
        {notion && notion.status === "error" && <span className="chip chip-bad">Lỗi, dán lại khoá</span>}
        {notion && state === "ok" && <span className="chip chip-ok"><span className="inline-block h-1.5 w-1.5 rounded-full bg-ok-deep" />Đội đã có Notion</span>}
        {notion && state === "pending" && <span className="chip chip-warn"><span className="pulse inline-block h-1.5 w-1.5 rounded-full bg-warn" />Sẽ gắn khi đội rảnh</span>}
        {notion && state.startsWith("error") && <span className="chip chip-bad">Chưa gắn được cho đội</span>}
      </div>

      {error && <div className="rounded-[18px] bg-bad-soft px-4 py-3 text-[13px] leading-relaxed text-bad">{error}</div>}

      {!notion && (
        <>
          <section className="overflow-hidden rounded-[18px] border border-line bg-card">
            <div className="px-4 pb-2.5 pt-3.5 text-[15px] font-bold">Ba bước trong Notion</div>
            <Step n={1} title="Tạo tích hợp" body="Mở trang tích hợp của Notion, tạo tích hợp mới dạng nội bộ cho không gian làm việc của bạn.">
              <a href="https://www.notion.so/profile/integrations" target="_blank" rel="noreferrer" className="btn btn-xs btn-outline self-start">Mở trang tích hợp Notion <IconExternal /></a>
            </Step>
            <Step n={2} title="Bật ba quyền" body="Đọc nội dung, cập nhật nội dung, chèn nội dung. Lưu lại rồi chép khoá bí mật, khoá bắt đầu bằng ntn_." />
            <Step n={3} title="Kết nối trang" body="Trong Notion, mở trang bạn muốn đội dùng, bấm dấu ba chấm, chọn Kết nối rồi chọn tích hợp vừa tạo. Bảng cần đội đọc cũng làm vậy." />
          </section>
          <KeyForm label="Khoá bí mật" button="Kết nối" />
          <p className="px-1 text-xs leading-relaxed text-muted">Sau khi kết nối, bạn chọn bảng để đội đọc và trang để đội lưu cho từng thương hiệu.</p>
        </>
      )}

      {notion && (
        <>
          {notion.status === "error" && (
            <div className="flex flex-col gap-2 rounded-[18px] bg-bad-soft p-4 text-bad">
              <div className="text-sm font-bold">Notion từ chối khoá{notion.checkedAt ? ` từ ${time(notion.checkedAt)}` : ""}</div>
              <div className="text-[13px] leading-relaxed">{notion.error}. Thường do khoá bị thu hồi trong Notion. Tạo khoá mới trong trang tích hợp rồi dán vào đây.</div>
            </div>
          )}
          {state === "pending" && <div className="rounded-[18px] border-[1.5px] border-warn-line bg-warn-soft px-4 py-3 text-[13px] leading-relaxed text-warn"><b>Đội đang làm việc.</b> Notion sẽ được gắn cho đội ngay khi đội rảnh, bạn không cần làm gì thêm.</div>}
          {state === "none" && !publicUrl() && <div className="rounded-[18px] border border-line bg-card px-4 py-3 text-[13px] leading-relaxed text-muted">Máy chủ này không có địa chỉ công khai nên đội chưa gọi được Notion từ đây. Trên bản đã triển khai, đội được gắn tự động.</div>}
          {state.startsWith("error") && (
            <form action={retryAttach} className="flex flex-col gap-2 rounded-[18px] border-[1.5px] border-warn-line bg-warn-soft p-4 text-warn">
              <div className="text-[13px] leading-relaxed"><b>Chưa gắn được cho đội.</b> {state.slice(7)}</div>
              <SubmitButton className="btn btn-xs btn-warn self-start" pendingLabel="Đang gắn…">Gắn lại cho đội</SubmitButton>
            </form>
          )}

          <section className="overflow-hidden rounded-[18px] border border-line bg-card">
            <div className="row"><span className="row-label">Tích hợp</span><span className="min-w-0 flex-1 truncate text-sm">{notion.label}</span></div>
            <div className="row"><span className="row-label">Kết nối từ</span><span className="text-sm">{time(notion.connectedAt)}</span></div>
            <div className="row items-start">
              <form action={disconnectNotion} className="flex-none"><SubmitButton className="btn btn-xs btn-ghost" pendingLabel="Đang ngắt…">Ngắt kết nối</SubmitButton></form>
              <span className="text-xs leading-relaxed text-muted">Đội mất quyền đọc ngay. Bản sao đã lưu trong Notion giữ nguyên.</span>
            </div>
          </section>
          <details className="group">
            <summary className="cursor-pointer list-none text-sm font-semibold text-accent-deep">Dán khoá mới</summary>
            <div className="pt-2"><KeyForm label="Khoá bí mật mới" button="Dán lại khoá" /></div>
          </details>

          <div className="flex items-center justify-between gap-2 px-0.5">
            <div className="eyebrow">Cho thương hiệu này</div>
            <span className="chip chip-outline">{name}</span>
          </div>

          <section className="overflow-hidden rounded-[18px] border border-line bg-card">
            <div className="flex flex-col gap-2 p-4">
              <div className="text-sm font-semibold">Đọc</div>
              {read ? (
                <Value icon={<IconTable size={20} />} title={read.title} sub="Bảng · đội tra khi nghiên cứu" url={read.url} chip={<span className="chip chip-ok">Đọc được</span>} />
              ) : (
                <div className="text-[13px] leading-relaxed text-muted">Dán link một bảng Notion đã kết nối với tích hợp. Đội tra bảng này khi nghiên cứu, cùng với internet.</div>
              )}
              <LinkForm action={setNotionRead} placeholder="Dán link bảng Notion" button={read ? "Đổi bảng" : "Chọn bảng"} clear={read ? "Thôi đọc" : null} />
            </div>
            <div className="flex flex-col gap-2 border-t border-line-soft p-4">
              <div className="text-sm font-semibold">Lưu vào</div>
              {save ? (
                <>
                  <Value icon={<IconFile size={20} />} title={save.title} sub={dbs?.posts && dbs.reports && dbs.cards ? "Trang · ứng dụng đã tạo 3 bảng" : "Trang · bảng sẽ được tạo ở lần lưu đầu"} url={save.url} chip={<span className="chip chip-ok">Sẵn sàng</span>} />
                  <div className="flex flex-wrap gap-1.5">{["Bài đã duyệt", "Báo cáo tuần", "Thẻ thương hiệu"].map((t) => <span key={t} className="chip chip-outline">{t}</span>)}</div>
                  <div className="text-xs leading-relaxed text-muted">Mỗi dòng có cột Thương hiệu, nên nhiều thương hiệu dùng chung một trang.</div>
                </>
              ) : (
                <div className="text-[13px] leading-relaxed text-muted">Dán link một trang Notion đã kết nối với tích hợp. Ứng dụng tạo ba bảng trong đó: Bài đã duyệt, Báo cáo tuần, Thẻ thương hiệu.</div>
              )}
              <LinkForm action={setNotionSave} placeholder="Dán link trang Notion" button={save ? "Đổi trang" : "Chọn trang"} clear={save ? "Thôi lưu" : null} />
            </div>
            {save && (
              <div className="flex flex-col gap-2 border-t border-line-soft p-4">
                <div className="text-sm font-semibold">Lần lưu gần nhất</div>
                {recent.length === 0 && <div className="text-[13px] text-muted">Chưa có gì để lưu. Bài bạn duyệt, báo cáo tuần và thẻ sẽ tự sang đây.</div>}
                {recent.map((r) => (
                  <div key={r.id} className="flex items-center gap-2.5">
                    <span className={`inline-block h-2 w-2 flex-none rounded-full ${r.status === "ok" ? "bg-ok" : "bg-warn-line"}`} />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{time(r.createdAt)}{r.error ? ` · ${r.error}` : ""}</span>
                    {r.status === "ok" && r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="chip chip-ok">Mở</a> : <span className="chip chip-warn">Sẽ thử lại</span>}
                  </div>
                ))}
                <div className="text-xs leading-relaxed text-muted">Lưu tự động sau khi bạn duyệt. Lỗi thì ứng dụng thử lại ở lần tải trang sau.</div>
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

function KeyForm({ label, button }: { label: string; button: string }) {
  return (
    <form action={connectNotion} className="card flex flex-col gap-2.5">
      <label htmlFor="secret" className="text-sm font-semibold">{label}</label>
      <textarea id="secret" name="secret" rows={3} className="input resize-none" placeholder="Dán khoá bắt đầu bằng ntn_" required autoComplete="off" spellCheck={false} />
      <div className="text-xs leading-relaxed text-muted">Mã hoá rồi cất trong ứng dụng. Đội không bao giờ thấy khoá, chỉ thấy những trang bạn đã kết nối.</div>
      <SubmitButton className="btn btn-accent" pendingLabel="Đang kiểm tra khoá…">{button}</SubmitButton>
    </form>
  );
}

function LinkForm({ action, placeholder, button, clear }: { action: (fd: FormData) => Promise<void>; placeholder: string; button: string; clear: string | null }) {
  return (
    <div className="flex flex-col gap-2">
      <form action={action} className="flex flex-col gap-2">
        <input name="link" className="input" placeholder={placeholder} required autoComplete="off" />
        <SubmitButton className="btn btn-sm btn-dark self-start" pendingLabel="Đang kiểm tra…">{button}</SubmitButton>
      </form>
      {clear && (
        <form action={action}>
          <input type="hidden" name="clear" value="1" />
          <SubmitButton className="btn btn-sm btn-ghost" pendingLabel="…">{clear}</SubmitButton>
        </form>
      )}
    </div>
  );
}

function Value({ icon, title, sub, url, chip }: { icon: React.ReactNode; title: string; sub: string; url: string; chip: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[14px] border border-line bg-bg px-3 py-2.5">
      <span className="flex-none text-accent-deep">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {url ? <a href={url} target="_blank" rel="noreferrer" className="truncate text-sm font-semibold text-ink">{title}</a> : <span className="truncate text-sm font-semibold">{title}</span>}
        <span className="text-xs text-muted">{sub}</span>
      </span>
      {chip}
    </div>
  );
}
