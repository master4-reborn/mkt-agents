"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runWeek, sendMessage } from "@/app/actions";
import { IconSend, IconSpinner, IconX } from "./Icons";
import { SubmitButton } from "./SubmitButton";
import { MessageBox, clearBox, grow } from "./MessageBox";
import { DOOR, INK, LEAD_QUICK, META, STATE_COLOR, STATE_LABEL, WORKER_QUICK, privateOrder, type Agent, type MapEmployee, type Worker } from "./island-meta";

// The DOM half of the island: the composer under the scene, the employee card and the toast.
// Every order here is the same server action the chat page uses; the lead gets it and answers in chat.

// Sends one order at a time and remembers how it went, for a few seconds.
function useSend() {
  const router = useRouter();
  const [, start] = useTransition();
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const send = (text: string, onOk?: () => void) => {
    if (pending || !text.trim()) return;
    setPending(true);
    setNote(null);
    if (timer.current) clearTimeout(timer.current);
    start(async () => {
      let ok = false;
      try {
        const fd = new FormData();
        fd.set("text", text.trim());
        const r = await sendMessage(fd);
        if (r.ok) {
          ok = true;
          setNote({ ok: true, text: "Đã gửi, trưởng nhóm sẽ trả lời ở bong bóng" });
          onOk?.();
          router.refresh();
        } else {
          setNote({ ok: false, text: `Chưa gửi được: ${r.error}` });
        }
      } catch {
        setNote({ ok: false, text: "Chưa gửi được, thử lại" });
      } finally {
        setPending(false);
      }
      // A success note fades; a failure stays until the next try, so the reason can be read and reported.
      if (ok) timer.current = setTimeout(() => setNote(null), 6000);
    });
  };
  return { send, pending, note };
}

function SendButton({ pending, size = 46 }: { pending: boolean; size?: number }) {
  return (
    <button type="submit" aria-label={pending ? "Đang gửi" : "Gửi"} aria-busy={pending || undefined} disabled={pending} className="flex flex-none items-center justify-center rounded-[14px] bg-accent text-white" style={{ width: size, height: size, opacity: pending ? 0.85 : 1 }}>
      {pending ? <IconSpinner size={20} className="spin" /> : <IconSend />}
    </button>
  );
}

function Note({ note }: { note: { ok: boolean; text: string } | null }) {
  if (!note) return null;
  return <div role="status" className={`text-[12px] font-semibold ${note.ok ? "text-ok-deep" : "text-bad"}`}>{note.text}</div>;
}

// The bar at the bottom of the island. With a worker chosen, the order goes to the lead marked for that worker.
export function Composer({ running, target, onClearTarget, className = "" }: { running: boolean; target: Worker | null; onClearTarget: () => void; className?: string }) {
  const input = useRef<HTMLTextAreaElement>(null);
  const { send, pending, note } = useSend();
  const fill = (text: string) => {
    if (!input.current) return;
    input.current.value = text;
    grow(input.current);
    input.current.focus();
  };
  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.current?.value.trim() ?? "";
    if (!text) return;
    send(target ? privateOrder(target, text) : text, () => clearBox(input.current));
  };
  return (
    <div className={`flex-col gap-2 rounded-[18px] border border-line bg-card p-3 shadow-[0_8px_30px_rgba(207,61,122,0.12)] ${className}`}>
      <div className="flex gap-2 overflow-x-auto">
        {target && (
          <button type="button" onClick={onClearTarget} className="chip chip-accent h-9 flex-none px-3 text-[13px]" aria-label={`Bỏ nhắn riêng ${META[target].name}`}>
            Nhắn riêng {META[target].name} <IconX size={14} />
          </button>
        )}
        {!target && (
          <form action={runWeek}>
            <SubmitButton className="chip h-9 flex-none border border-line bg-bg px-3 text-[13px] text-accent-deep" pendingLabel="Đang gửi lệnh…" spinnerSize={14} disabled={running}>
              Chạy tuần mới
            </SubmitButton>
          </form>
        )}
        {LEAD_QUICK.map((q) => (
          <button key={q.label} type="button" onClick={() => fill(q.text)} className="chip h-9 flex-none border border-line bg-bg px-3 text-[13px] text-accent-deep">
            {q.label}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="flex items-end gap-2">
        <label htmlFor="island-msg" className="sr-only">Nhắn trưởng nhóm</label>
        <MessageBox id="island-msg" ref={input} className="flex-1" placeholder={target ? `Nhắn ${META[target].name}, qua trưởng nhóm` : "Nhắn trưởng nhóm, tiếng Việt là được"} onSend={submit} />
        <SendButton pending={pending} />
      </form>
      {note ? <Note note={note} /> : <div className="text-[11.5px] text-muted">{target ? `Trưởng nhóm nhận rồi chuyển cho ${META[target].name}. Hiện ở trang Trò chuyện như mọi lệnh.` : "Gửi như ở trang Trưởng nhóm. Trả lời hiện ở bong bóng của trưởng nhóm."}</div>}
    </div>
  );
}

// The card about one employee: panel on the right on a wide screen, sheet above the tabs on a phone.
export function AgentCard({ agent, e, state, waiting, onClose, className = "" }: { agent: Agent; e: MapEmployee; state: MapEmployee["state"]; waiting: number; onClose?: () => void; className?: string }) {
  const m = META[agent];
  const since = e.since ? new Date(e.since).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : null;
  const input = useRef<HTMLInputElement>(null);
  const { send, pending, note } = useSend();
  const worker: Worker | null = agent === "lead" ? null : agent;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.current?.value.trim() ?? "";
    if (!text || !worker) return;
    send(privateOrder(worker, text), () => { if (input.current) input.current.value = ""; });
  };
  return (
    <aside aria-label={m.name} className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-white text-2xl shadow-sm" style={{ background: m.fur }} aria-hidden>
          🐱
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-bold" style={{ color: INK }}>{m.name}</div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-600">
            <span className={`inline-block h-2 w-2 rounded-full ${state === "working" ? "animate-pulse" : ""}`} style={{ background: STATE_COLOR[state] }} />
            {STATE_LABEL[state]}
            {since && <span>· từ {since}</span>}
          </div>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Đóng" className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-white text-muted">
            <IconX size={16} />
          </button>
        )}
      </div>
      <p className="text-sm text-zinc-700">{m.job}</p>
      <div>
        <div className="inline-block rounded-2xl rounded-bl-sm px-3 py-1.5 text-[12px] font-semibold text-white" style={{ background: INK }}>{agent === "lead" ? "Lệnh gần nhất của bạn" : "Sếp giao gì?"}</div>
        <p className="mt-1.5 whitespace-pre-wrap text-sm text-zinc-800">{e.task ? e.task.slice(0, 600) : "Chưa có."}</p>
      </div>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: `${INK}b3` }}>Báo cáo gần nhất</div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800">{e.report ? e.report.slice(0, 900) : "Chưa có."}</p>
      </div>
      {agent === "lead" && (
        <div className="flex flex-wrap gap-1.5">
          {waiting > 0 && <Link href="/drafts" className="btn btn-xs btn-outline">Duyệt {waiting} bài</Link>}
          <Link href="/reports" className="btn btn-xs btn-outline">Nhập số liệu</Link>
        </div>
      )}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: `${INK}b3` }}>Công cụ</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {m.tools.split(", ").map((t) => (
            <span key={t} className="rounded-md bg-white px-2 py-0.5 text-[12px] ring-1 ring-pink-200" style={{ color: INK }}>{t}</span>
          ))}
        </div>
      </div>
      {worker && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: `${INK}b3` }}>Giao việc riêng</div>
          <div className="flex flex-wrap gap-1.5">
            {WORKER_QUICK[worker].map((q) => (
              <button key={q.label} type="button" disabled={pending} onClick={() => send(privateOrder(worker, q.text))} className="btn btn-xs btn-outline">
                {q.label}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="flex items-center gap-2">
            <label htmlFor="island-private" className="sr-only">Nhắn {m.name}</label>
            <input id="island-private" ref={input} name="text" className="input h-[44px] flex-1 bg-white" placeholder={`Nhắn ${m.name}, ví dụ: xem thêm shop ở Đà Lạt`} required autoComplete="off" />
            <SendButton pending={pending} size={44} />
          </form>
          {note ? <Note note={note} /> : <div className="text-[11.5px] text-muted">Đi qua trưởng nhóm, hiện ở trang Trò chuyện như mọi lệnh.</div>}
        </div>
      )}
      <Link href={DOOR[agent].href} className="btn btn-sm btn-dark mt-auto">{agent === "lead" ? "Mở trò chuyện" : `Mở trang ${DOOR[agent].label.replace(/^Mở /, "")}`}</Link>
    </aside>
  );
}

// "Trưởng nhóm vừa báo cáo": shows for a few seconds when a reply lands while you watch.
export function Toast({ text, onOpen, className = "" }: { text: string; onOpen: () => void; className?: string }) {
  return (
    <button type="button" onClick={onOpen} role="status" className={`flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-2 text-[12.5px] font-semibold text-ink shadow-[0_6px_20px_rgba(207,61,122,0.12)] ${className}`}>
      <span className="inline-block h-2 w-2 rounded-full bg-ok" />
      {text}
      <span className="text-accent-deep">Xem</span>
    </button>
  );
}
