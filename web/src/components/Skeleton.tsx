import { CatAvatar } from "./CatAvatar";

// Pink-grey bars in the shape of the page that is coming. The loading files use these while a page renders.
export function Bone({ w = "100%", h = 12, r = 8, soft, className = "" }: { w?: string | number; h?: string | number; r?: number; soft?: boolean; className?: string }) {
  return <div aria-hidden className={`bone ${soft ? "bone-soft" : ""} ${className}`} style={{ width: w, height: h, borderRadius: r }} />;
}

// Header with the cat and the page name real, the status line and cost pill as bones.
export function HeaderBones({ title }: { title: string }) {
  return (
    <header className="flex items-center gap-2.5">
      <CatAvatar size={36} />
      <div className="flex flex-col gap-1.5">
        <div className="text-[17px] font-bold leading-tight">{title}</div>
        <Bone w={120} h={10} />
      </div>
      <Bone w={86} h={28} r={999} className="ml-auto" />
    </header>
  );
}

// The pink hero block.
export function HeroBones() {
  return (
    <section aria-busy="true" className="flex flex-col gap-3 rounded-[20px] bg-accent-soft p-5">
      <Bone soft w={92} h={10} />
      <Bone soft w="70%" h={26} />
      <Bone soft w="50%" h={26} />
      <Bone soft w="85%" h={12} />
      <Bone soft h={52} r={14} />
    </section>
  );
}

// A card of n rows, each a circle and two lines.
export function RowBones({ n = 3 }: { n?: number }) {
  return (
    <div aria-busy="true" className="overflow-hidden rounded-2xl border border-line bg-card">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-line-soft p-3.5 last:border-b-0">
          <Bone w={22} h={22} r={999} className="flex-none" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Bone w={`${78 - (i % 3) * 12}%`} h={12} />
            <Bone w={`${46 + (i % 2) * 8}%`} h={10} />
          </div>
        </div>
      ))}
    </div>
  );
}

// A post card: author line, three lines of text, a length bar.
export function CardBones({ lines = 3 }: { lines?: number }) {
  return (
    <article aria-busy="true" className="card flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <Bone w={40} h={40} r={999} className="flex-none" />
        <div className="flex flex-col gap-1.5"><Bone w={110} h={12} /><Bone w={160} h={10} /></div>
      </div>
      {Array.from({ length: lines }, (_, i) => <Bone key={i} w={i === lines - 1 ? "60%" : "100%"} h={12} />)}
      <Bone h={6} r={999} />
    </article>
  );
}

export function TabBones({ n = 3 }: { n?: number }) {
  return (
    <div aria-hidden className="tabs" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
      {Array.from({ length: n }, (_, i) => <div key={i} className="tab"><Bone w={80} h={12} /></div>)}
    </div>
  );
}
