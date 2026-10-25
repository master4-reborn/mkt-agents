"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { CatAvatar } from "./CatAvatar";

// Shown while the 3D library downloads. Same box as the scene, so nothing moves when it appears.
function Loading() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div role="status" aria-busy="true" className="flex h-[56vh] min-h-[380px] flex-col items-center justify-center gap-3 rounded-3xl bg-accent-soft sm:h-[62vh] lg:h-full lg:min-h-[520px]">
      <span className="bob"><CatAvatar size={88} /></span>
      <div className="text-[15px] font-bold text-accent-deep">Đang dựng văn phòng…</div>
      {slow && <div className="text-xs text-muted">Mạng chậm, bạn vẫn dùng được phần còn lại.</div>}
    </div>
  );
}

const Office3D = dynamic(() => import("./Office3D"), { ssr: false, loading: Loading });

export default Office3D;
