"use client";

import { useState } from "react";

const OPTIONS = [
  ["off", "Tắt"],
  ["2w", "2 tuần một lần"],
  ["month", "Mỗi tháng"],
] as const;

// How often the scout looks for skills just for the new brand. Off by default: shared skills reach every brand anyway.
export function ScoutPick() {
  const [pick, setPick] = useState("off");
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-xs font-semibold text-ink-soft">Trinh sát tìm kỹ năng riêng cho thương hiệu này</legend>
      <div className="grid grid-cols-3 gap-1.5">
        {OPTIONS.map(([value, label]) => (
          <label key={value} className={`flex h-11 cursor-pointer items-center outline-accent focus-within:outline-2 justify-center rounded-xl bg-card px-1.5 text-center text-[13px] font-semibold ${pick === value ? "border-[1.5px] border-accent text-accent-deep" : "border border-line text-ink-soft"}`}>
            <input type="radio" name="scout" value={value} checked={pick === value} onChange={() => setPick(value)} className="sr-only" />
            {label}
          </label>
        ))}
      </div>
      <span className="text-xs leading-relaxed text-[#6b3d53]">
        {pick === "off"
          ? "Kỹ năng chung vẫn đến thương hiệu này. Bật sau ở trang Thương hiệu khi cần kỹ năng chỉ cho thương hiệu này."
          : "Mỗi lần khoảng 2,6 USD, trừ vào trần 20 USD một tháng của trinh sát, không trừ ngân sách thương hiệu. Lần đầu chạy sau khi thẻ thương hiệu xong."}
      </span>
    </fieldset>
  );
}
