"use client";

import { useEffect } from "react";

// Keeps the newest message in view: scrolls to the bottom when the chat opens and whenever a message arrives.
export function ScrollToEnd({ count }: { count: number }) {
  useEffect(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [count]);
  return null;
}
