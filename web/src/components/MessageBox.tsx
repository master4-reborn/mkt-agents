"use client";

import type { Ref } from "react";

// A one-line box that grows with the text, up to a few lines. Enter sends, Shift+Enter starts a new line.
// Enter during Vietnamese input composition is left to the keyboard.
export function MessageBox({ id, placeholder, onSend, ref, className = "" }: { id: string; placeholder: string; onSend: () => void; ref?: Ref<HTMLTextAreaElement>; className?: string }) {
  return (
    <textarea
      id={id}
      ref={ref}
      name="text"
      rows={1}
      required
      autoComplete="off"
      placeholder={placeholder}
      className={`input min-h-[46px] max-h-[160px] resize-none py-3 leading-[22px] ${className}`}
      onInput={(e) => grow(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault();
          onSend();
        }
      }}
    />
  );
}

export function grow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
}

export function clearBox(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.value = "";
  el.style.height = "auto";
}
