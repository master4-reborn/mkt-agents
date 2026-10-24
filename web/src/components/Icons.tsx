import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size: number, p: P) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...p,
});

export const IconHome = ({ size = 22, ...p }: P) => <svg {...base(size, p)}><path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></svg>;
export const IconFile = ({ size = 22, ...p }: P) => <svg {...base(size, p)}><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /></svg>;
export const IconSearch = ({ size = 22, ...p }: P) => <svg {...base(size, p)}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>;
export const IconChat = ({ size = 22, ...p }: P) => <svg {...base(size, p)}><path d="M4 5h16v11H9l-5 4z" /></svg>;
export const IconBars = ({ size = 22, ...p }: P) => <svg {...base(size, p)}><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-8" /><path d="M22 20H2" /></svg>;
export const IconStar = ({ size = 22, ...p }: P) => <svg {...base(size, p)}><path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z" /></svg>;
export const IconCube = ({ size = 22, ...p }: P) => <svg {...base(size, p)}><path d="M12 2l9 5v10l-9 5-9-5V7z" /><path d="M12 12l9-5" /><path d="M12 12v10" /><path d="M12 12L3 7" /></svg>;
export const IconCheck = ({ size = 14, ...p }: P) => <svg {...base(size, { strokeWidth: 3, ...p })}><path d="M5 12l4 4 10-10" /></svg>;
export const IconX = ({ size = 14, ...p }: P) => <svg {...base(size, { strokeWidth: 3, ...p })}><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>;
export const IconChevron = ({ size = 18, ...p }: P) => <svg {...base(size, p)}><path d="M9 6l6 6-6 6" /></svg>;
export const IconBack = ({ size = 20, ...p }: P) => <svg {...base(size, p)}><path d="M15 5l-7 7 7 7" /></svg>;
export const IconCopy = ({ size = 16, ...p }: P) => <svg {...base(size, p)}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5h10" /></svg>;
export const IconSend = ({ size = 20, ...p }: P) => <svg {...base(size, { strokeWidth: 2.2, ...p })}><path d="M4 12h14" /><path d="M12 6l6 6-6 6" /></svg>;
export const IconPlay = ({ size = 16, ...p }: P) => <svg {...base(size, { fill: "currentColor", stroke: "none", ...p })}><path d="M7 5l12 7-12 7z" /></svg>;
export const IconRefresh = ({ size = 16, ...p }: P) => <svg {...base(size, p)}><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v5h-5" /></svg>;
