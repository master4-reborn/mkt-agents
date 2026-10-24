import Link from "next/link";

const items = [
  ["/", "Bảng"],
  ["/drafts", "Bài"],
  ["/research", "Nghiên cứu"],
  ["/reports", "Báo cáo"],
  ["/brand", "Thương hiệu"],
  ["/chat", "Trò chuyện"],
];

export function Nav() {
  return (
    <nav className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-1 overflow-x-auto px-4 py-2 text-sm">
        <span className="mr-2 font-semibold">Văn phòng</span>
        {items.map(([href, label]) => (
          <Link key={href} href={href} className="rounded-md px-2.5 py-1.5 text-zinc-700 hover:bg-zinc-100 whitespace-nowrap">
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
