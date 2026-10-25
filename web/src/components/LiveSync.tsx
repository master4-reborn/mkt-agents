"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type S = { status: string; listCostUsd: number };

// Keeps every page fresh without blocking it: asks the office for news as soon as the page is up,
// then every 8 s while the team works and every 30 s when it is idle. Re-renders only when something changed.
export function LiveSync({ initial }: { initial: S }) {
  const router = useRouter();
  const last = useRef<S>(initial);
  useEffect(() => {
    last.current = initial;
  }, [initial]);
  // Starts polling on mount and again when the status changes (an order just flipped it to running).
  // Depends on the status string, not the object, so a page refresh does not restart the loop.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const r = await fetch("/api/status", { cache: "no-store" });
        if (r.ok) {
          const next: S = await r.json();
          if (!alive) return;
          const changed = next.status !== last.current.status || next.listCostUsd !== last.current.listCostUsd;
          last.current = next;
          if (changed || next.status === "running") router.refresh();
        }
      } catch {}
      if (alive) timer = setTimeout(tick, last.current.status === "running" ? 8000 : 30000);
    };
    tick();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [initial.status, router]);
  return null;
}
