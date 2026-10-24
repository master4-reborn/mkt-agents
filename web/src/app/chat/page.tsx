import { requireAuth } from "@/lib/auth";
import { sync, conversation } from "@/lib/sync";
import { Markdown } from "@/components/Markdown";
import { sendMessage } from "../actions";

export const dynamic = "force-dynamic";

export default async function Chat() {
  await requireAuth();
  await sync().catch(() => {});
  const msgs = (await conversation(60)).filter((m) => m.role !== "status");
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Trò chuyện với trưởng nhóm</h1>
      <div className="space-y-3">
        {msgs.map((m) => (
          <div key={m.id} className={`card text-sm ${m.role === "boss" ? "ml-8 bg-zinc-100" : "mr-8"}`}>
            <div className="mb-1 text-xs text-zinc-500">{m.role === "boss" ? "Bạn" : "Trưởng nhóm"} · {m.createdAt.toLocaleString("vi-VN")}</div>
            <Markdown>{m.text}</Markdown>
          </div>
        ))}
      </div>
      <form action={sendMessage} className="card space-y-2">
        <textarea name="text" className="input" rows={3} placeholder="Ví dụ: approve content/drafts/2026-10-24-abc.md · hoặc dán nội dung CSV số liệu cho tuần này" required />
        <button className="btn-primary">Gửi</button>
      </form>
    </div>
  );
}
