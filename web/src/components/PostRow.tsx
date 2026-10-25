"use client";

import { useState, useTransition } from "react";
import { markPosted } from "@/app/actions";
import { CopyButton } from "./CopyButton";
import { IconCheck } from "./Icons";

// An approved post you still have to publish yourself. The circle ticks the moment you tap it;
// the row leaves once the server has recorded it, or comes back with a note if it could not.
export function PostRow({ name, title, post }: { name: string; title: string; post: string }) {
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [, start] = useTransition();
  const mark = () => {
    setDone(true);
    setFailed(false);
    start(async () => {
      try {
        const fd = new FormData();
        fd.set("name", name);
        await markPosted(fd);
      } catch {
        setDone(false);
        setFailed(true);
      }
    });
  };
  return (
    <div className={`flex items-center gap-3 border-b border-line-soft p-3.5 last:border-b-0 ${done ? "opacity-55" : ""}`}>
      <button
        type="button"
        onClick={mark}
        disabled={done}
        aria-label="Đánh dấu đã đăng"
        title="Đã đăng rồi"
        className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border-2 border-accent ${done ? "bg-accent text-white" : "text-transparent hover:bg-accent hover:text-white"}`}
      >
        <IconCheck size={12} />
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className={`truncate text-sm font-semibold ${done ? "line-through" : ""}`}>Đăng “{title}” lên Threads</div>
        <div className={`text-xs ${failed ? "text-bad" : "text-muted"}`}>{failed ? "Chưa ghi được, bấm lại." : done ? "Đã đăng" : "Đã duyệt · bấm tròn khi đăng xong"}</div>
      </div>
      <CopyButton text={post} />
    </div>
  );
}
