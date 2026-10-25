"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { runWeek, sendMessage } from "@/app/actions";
import { IconSend, IconSpinner } from "./Icons";
import { SubmitButton } from "./SubmitButton";

// The bar at the bottom of the chat. Your message shows at once, faded with "đang gửi",
// and settles into the conversation when the office has it. If it fails, the text comes back to the box.
export function ChatComposer({ waiting, running }: { waiting: number; running: boolean }) {
  const [pending, setPending] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.current?.value.trim();
    if (!text || pending) return;
    input.current!.value = "";
    setFailed(null);
    setPending(text);
    start(async () => {
      try {
        const fd = new FormData();
        fd.set("text", text);
        await sendMessage(fd);
      } catch {
        setFailed(text);
      } finally {
        setPending(null);
      }
    });
  };

  return (
    <>
      {pending && (
        <div className="flex max-w-[82%] flex-col gap-1 self-end rounded-[18px] rounded-br-[4px] bg-ink px-3.5 py-3 text-white opacity-70">
          <div className="whitespace-pre-line text-sm">{pending}</div>
          <div className="flex items-center justify-end gap-1.5 text-[10px] text-[#e9c3d4]">
            <span className="pulse inline-block h-1.5 w-1.5 rounded-full bg-[#e9c3d4]" />đang gửi
          </div>
        </div>
      )}
      {failed && (
        <div className="flex items-center gap-2 self-end rounded-[14px] border border-bad-soft bg-bad-soft px-3 py-2 text-[13px] text-bad">
          Chưa gửi được.
          <button type="button" className="font-semibold underline" onClick={() => { if (input.current) input.current.value = failed; setFailed(null); input.current?.focus(); }}>Lấy lại tin</button>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-[84px] z-20 flex flex-col gap-2.5 border-t border-line bg-card px-4 pb-3 pt-2.5 lg:static lg:rounded-[18px] lg:border lg:p-4">
        <div className="flex gap-2 overflow-x-auto">
          <form action={runWeek}>
            <SubmitButton className="chip h-9 flex-none border border-line bg-bg px-3 text-[13px] text-accent-deep" pendingLabel="Đang gửi lệnh…" spinnerSize={14} disabled={running}>
              Chạy tuần mới
            </SubmitButton>
          </form>
          <Link href="/brand" className="chip h-9 flex-none border border-line bg-bg px-3 text-[13px] text-accent-deep">Thẻ thương hiệu</Link>
          <Link href="/drafts" className="chip h-9 flex-none border border-line bg-bg px-3 text-[13px] text-accent-deep">Bài chờ duyệt · {waiting}</Link>
        </div>
        <form onSubmit={submit} className="flex items-center gap-2">
          <label htmlFor="msg" className="sr-only">Nhắn trưởng nhóm</label>
          <input id="msg" ref={input} name="text" className="input h-[46px] flex-1" placeholder="Nhắn trưởng nhóm, tiếng Việt là được" required autoComplete="off" />
          <button
            type="submit"
            aria-label={pending ? "Đang gửi" : "Gửi"}
            aria-busy={pending ? true : undefined}
            disabled={!!pending}
            className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[14px] bg-accent text-white"
            style={pending ? { opacity: 0.85, cursor: "wait" } : undefined}
          >
            {pending ? <IconSpinner size={20} className="spin" /> : <IconSend />}
          </button>
        </form>
      </div>
    </>
  );
}
