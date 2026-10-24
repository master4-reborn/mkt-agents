export const FUR: Record<string, string> = {
  lead: "#fff1e6",
  research: "#cdb8ff",
  writer: "#ff9ec4",
  qa: "#ffd0b0",
  metrics: "#fff0a8",
};
export const EMPLOYEE_NAME: Record<string, string> = {
  lead: "Điều phối",
  research: "Nghiên cứu",
  writer: "Viết bài",
  qa: "QA-QC",
  metrics: "Đo số liệu",
};

const DOT = { working: "#e0a000", done: "#15875a", waiting: "#b08aa0" } as const;

// The team's face: a round kawaii cat head in the employee's fur colour, with an optional status dot.
export function CatAvatar({ agent = "lead", size = 40, state, className = "" }: { agent?: string; size?: number; state?: keyof typeof DOT | null; className?: string }) {
  const fur = FUR[agent] ?? FUR.lead;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className={`${state === "working" ? "" : ""} ${className}`}>
      <path d="M8 16l3-10 7 6h4l7-6 3 10" fill={fur} />
      <circle cx="20" cy="23" r="13" fill={fur} />
      <circle cx="15" cy="22" r="1.6" fill="#2b1a22" />
      <circle cx="25" cy="22" r="1.6" fill="#2b1a22" />
      <path d="M18.5 26.5q1.5 1.5 3 0" stroke="#2b1a22" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      {state && <circle cx="33" cy="33" r="5" fill={DOT[state]} stroke="#fff7fa" strokeWidth="2" className={state === "working" ? "pulse" : ""} />}
    </svg>
  );
}
