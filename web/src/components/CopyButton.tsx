"use client";

import { useState } from "react";
import { IconCheck, IconCopy } from "./Icons";

export function CopyButton({ text, className = "btn btn-xs btn-ghost text-accent-deep", label = "Sao chép" }: { text: string; className?: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); } catch { return; }
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? <IconCheck size={14} /> : <IconCopy />}
      {done ? "Đã sao chép" : label}
    </button>
  );
}
