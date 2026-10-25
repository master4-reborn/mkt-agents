"use client";

import Link from "next/link";
import { useState } from "react";

type Tab = { key: string; label: string; href: string };

// A tab strip whose tapped tab lights up at once, before the page for it arrives.
export function TabLinks({ tabs, current, label }: { tabs: Tab[]; current: string; label: string }) {
  const [pending, setPending] = useState<string | null>(null);
  const [seen, setSeen] = useState(current);
  if (seen !== current) {
    // The new tab's page has arrived: drop the optimistic highlight.
    setSeen(current);
    setPending(null);
  }
  const on = pending ?? current;
  return (
    <div role="tablist" aria-label={label} className="tabs" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} role="tab" aria-current={t.key === on ? "page" : undefined} className="tab" onClick={() => setPending(t.key)}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}
