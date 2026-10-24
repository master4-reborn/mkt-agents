"use client";

import dynamic from "next/dynamic";

const Office3D = dynamic(() => import("./Office3D"), {
  ssr: false,
  loading: () => <div className="h-[56vh] min-h-[380px] animate-pulse rounded-3xl bg-accent-soft sm:h-[62vh] lg:h-full lg:min-h-[520px]" />,
});

export default Office3D;
