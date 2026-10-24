"use client";

import { useState } from "react";
import Link from "next/link";

export type MapEmployee = {
  agent: "lead" | "research" | "writer" | "qa" | "metrics";
  state: "working" | "done" | "waiting";
  task: string | null;
  report: string | null;
  since: string | null;
};

const META: Record<MapEmployee["agent"], { name: string; color: string; dark: string; tools: string; job: string }> = {
  lead: { name: "Điều phối", color: "#a1a1aa", dark: "#3f3f46", tools: "Giao việc, đọc, ghi", job: "Nhận lệnh của bạn, chia việc, báo cáo ba dòng" },
  research: { name: "Nghiên cứu", color: "#c4b5fd", dark: "#7c3aed", tools: "Tìm web, đọc web, bash", job: "Quét đối thủ và bình luận, bảng nỗi đau, 5 chủ đề" },
  writer: { name: "Viết bài", color: "#f9a8d4", dark: "#be185d", tools: "Chỉ đọc, ghi file", job: "3 đến 5 bài nháp mỗi tuần, đúng giọng thương hiệu" },
  qa: { name: "QA-QC", color: "#93c5fd", dark: "#1d4ed8", tools: "Chỉ đọc, ghi file", job: "Soát số liệu, từ cấm, giọng, độ dài; đặt trạng thái" },
  metrics: { name: "Đo số liệu", color: "#fde68a", dark: "#b45309", tools: "Đọc CSV, bash", job: "So sánh tuần, lặp lại / bỏ, việc cho thứ 2" },
};

const POS: Record<MapEmployee["agent"], [number, number]> = {
  lead: [400, 310],
  research: [185, 160],
  writer: [615, 160],
  qa: [185, 450],
  metrics: [615, 450],
};

const STATE_LABEL = { working: "Đang chạy", done: "Xong việc", waiting: "Chờ việc" } as const;
const STATE_COLOR = { working: "#f59e0b", done: "#10b981", waiting: "#a1a1aa" } as const;

function wrap(text: string, max = 24, lines = 2): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      out.push(cur.trim());
      cur = w;
      if (out.length === lines) break;
    } else cur = (cur + " " + w).trim();
  }
  if (out.length < lines && cur) out.push(cur);
  if (out.length === lines && words.join(" ").length > out.join(" ").length) out[lines - 1] = out[lines - 1].slice(0, max - 1) + "…";
  return out;
}

function firstLine(text: string | null): string {
  if (!text) return "";
  const t = text.replace(/^\s*(1[.)]|Done:|Đã làm:)\s*/i, "").replace(/[*_`#]/g, "");
  return t.split(/\n/)[0].slice(0, 90);
}

function bubbleText(e: MapEmployee, waiting: number): string {
  if (e.agent === "lead") {
    if (e.state === "working") return "Đang điều phối đội…";
    return waiting > 0 ? `${waiting} bài chờ sếp duyệt` : firstLine(e.report) || "Sẵn sàng nhận lệnh";
  }
  if (e.state === "working") return "Đang làm: " + (firstLine(e.task) || "việc sếp giao");
  if (e.state === "done") return firstLine(e.report) || "Đã xong việc";
  return "Chờ việc";
}

function Desk({ x, y, color, dark, wide = 56 }: { x: number; y: number; color: string; dark: string; wide?: number }) {
  const h = wide * 0.38;
  return (
    <g>
      <polygon points={`${x - wide},${y + 1} ${x},${y + h + 1} ${x},${y + h + 20} ${x - wide},${y + 20}`} fill={dark} opacity="0.55" />
      <polygon points={`${x},${y + h + 1} ${x + wide},${y + 1} ${x + wide},${y + 20} ${x},${y + h + 20}`} fill={dark} opacity="0.35" />
      <polygon points={`${x},${y - h} ${x + wide},${y} ${x},${y + h} ${x - wide},${y}`} fill={color} stroke={dark} strokeOpacity="0.25" />
      <rect x={x - 11} y={y - 24} width="22" height="15" rx="2" fill="#27272a" />
      <rect x={x - 9} y={y - 22} width="18" height="11" rx="1" fill="#93c5fd" />
      <rect x={x - 2} y={y - 9} width="4" height="5" fill="#27272a" />
    </g>
  );
}

function Person({ x, y, color, dark, working }: { x: number; y: number; color: string; dark: string; working: boolean }) {
  return (
    <g>
      {working && <circle cx={x} cy={y - 50} r="22" fill="none" stroke="#f59e0b" strokeWidth="2" className="animate-ping" style={{ transformOrigin: `${x}px ${y - 50}px` }} />}
      <ellipse cx={x} cy={y - 22} rx="15" ry="18" fill={dark} />
      <circle cx={x} cy={y - 50} r="14" fill="#fde2c8" />
      <path d={`M${x - 14},${y - 52} a14,14 0 0 1 28,0 l0,-4 a14,14 0 0 0 -28,0 z`} fill={color} />
      <circle cx={x - 5} cy={y - 50} r="1.8" fill="#27272a" />
      <circle cx={x + 5} cy={y - 50} r="1.8" fill="#27272a" />
      <path d={`M${x - 4},${y - 44} q4,3 8,0`} stroke="#27272a" strokeWidth="1.2" fill="none" />
    </g>
  );
}

function Bubble({ x, y, text, working }: { x: number; y: number; text: string; working: boolean }) {
  const lines = wrap(text);
  const w = 176, h = 16 + lines.length * 15;
  return (
    <g>
      <rect x={x - w / 2} y={y - h - 78} width={w} height={h} rx="9" fill="white" stroke={working ? "#f59e0b" : "#d4d4d8"} strokeWidth={working ? 1.5 : 1} />
      <polygon points={`${x - 6},${y - 78} ${x + 6},${y - 78} ${x},${y - 70}`} fill="white" stroke={working ? "#f59e0b" : "#d4d4d8"} />
      <rect x={x - w / 2 + 1} y={y - 79} width={w - 2} height="3" fill="white" />
      <text x={x} y={y - h - 78 + 17} textAnchor="middle" fontSize="11" fill="#27272a">
        {lines.map((l, i) => (
          <tspan key={i} x={x} dy={i === 0 ? 0 : 15}>{l}</tspan>
        ))}
      </text>
    </g>
  );
}

function Station({ e, waiting, selected, onSelect }: { e: MapEmployee; waiting: number; selected: boolean; onSelect: () => void }) {
  const [x, y] = POS[e.agent];
  const m = META[e.agent];
  const working = e.state === "working";
  const isLead = e.agent === "lead";
  return (
    <g onClick={onSelect} style={{ cursor: "pointer" }}>
      {selected && <ellipse cx={x} cy={y + 14} rx={isLead ? 110 : 84} ry={isLead ? 46 : 36} fill="#f59e0b" opacity="0.12" />}
      <Desk x={x} y={y} color={m.color} dark={m.dark} wide={isLead ? 74 : 56} />
      <Person x={x} y={y} color={m.color} dark={m.dark} working={working} />
      <Bubble x={x} y={y} text={bubbleText(e, waiting)} working={working} />
      <rect x={x - 52} y={y + 30} width="104" height="22" rx="11" fill="white" stroke="#d4d4d8" />
      <circle cx={x - 38} cy={y + 41} r="4" fill={STATE_COLOR[e.state]} className={working ? "animate-pulse" : ""} />
      <text x={x + 6} y={y + 45} textAnchor="middle" fontSize="12" fontWeight="600" fill="#27272a">{m.name}</text>
    </g>
  );
}

export function OfficeMap({ team, waiting }: { team: MapEmployee[]; waiting: number }) {
  const [sel, setSel] = useState<MapEmployee["agent"]>(team.find((t) => t.state === "working" && t.agent !== "lead")?.agent ?? "lead");
  const [lx, ly] = POS.lead;
  const selected = team.find((t) => t.agent === sel)!;
  const m = META[sel];
  const others = team.filter((t) => t.agent !== "lead");
  return (
    <div className="space-y-4">
      <div className="card overflow-hidden p-0">
        <svg viewBox="0 0 800 560" role="img" aria-label="Sơ đồ văn phòng: đội AI và việc đang làm" className="block w-full" fontFamily="ui-sans-serif, system-ui, sans-serif">
          <polygon points="400,40 785,300 400,560 15,300" fill="#dcefd4" />
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <g key={i} stroke="#cfe3c4" strokeWidth="1">
              <line x1={15 + i * 48} y1={300 - i * 32.5} x2={400 + i * 48} y2={560 - i * 32.5} />
              <line x1={785 - i * 48} y1={300 - i * 32.5} x2={400 - i * 48} y2={560 - i * 32.5} />
            </g>
          ))}
          {others.map((t) => {
            const [x, y] = POS[t.agent];
            return (
              <g key={t.agent}>
                <line x1={lx} y1={ly + 10} x2={x} y2={y + 10} stroke="#efe5cf" strokeWidth="14" strokeLinecap="round" />
                {t.state === "working" && <line x1={lx} y1={ly + 10} x2={x} y2={y + 10} stroke="#f59e0b" strokeWidth="3" strokeDasharray="6 10" strokeLinecap="round" className="march" />}
              </g>
            );
          })}
          {[...team].sort((a, b) => POS[a.agent][1] - POS[b.agent][1]).map((t) => (
            <Station key={t.agent} e={t} waiting={waiting} selected={sel === t.agent} onSelect={() => setSel(t.agent)} />
          ))}
          <Link href="/drafts">
            <g style={{ cursor: "pointer" }}>
              <rect x={lx - 66} y={ly + 62} width="132" height="26" rx="13" fill={waiting > 0 ? "#7f1d1d" : "#3f3f46"} />
              <text x={lx} y={ly + 79} textAnchor="middle" fontSize="12" fontWeight="600" fill="white">Cổng duyệt · {waiting} bài</text>
            </g>
          </Link>
        </svg>
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: STATE_COLOR[selected.state] }} />
          <span className="font-semibold">{m.name}</span>
          <span className="chip bg-zinc-100 text-zinc-700">{STATE_LABEL[selected.state]}</span>
          {selected.since && <span className="text-xs text-zinc-500">từ {new Date(selected.since).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>}
        </div>
        <p className="text-sm text-zinc-600">{m.job}. Công cụ: {m.tools}.</p>
        {selected.task && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{sel === "lead" ? "Lệnh gần nhất của bạn" : "Việc được giao"}</div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{selected.task.slice(0, 700)}{selected.task.length > 700 ? "…" : ""}</p>
          </div>
        )}
        {selected.report && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{sel === "lead" ? "Báo cáo gần nhất" : "Báo cáo cho trưởng nhóm"}</div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{selected.report.slice(0, 900)}{selected.report.length > 900 ? "…" : ""}</p>
          </div>
        )}
        {!selected.task && !selected.report && <p className="text-sm text-zinc-500">Chưa có việc nào.</p>}
      </div>
    </div>
  );
}
