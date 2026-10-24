import { CatAvatar } from "@/components/CatAvatar";
import { loginAction } from "../actions";

export default async function Login({ searchParams }: { searchParams: Promise<{ bad?: string }> }) {
  const { bad } = await searchParams;
  return (
    <form action={loginAction} className="card mx-auto mt-16 flex max-w-sm flex-col gap-3">
      <div className="flex items-center gap-3">
        <CatAvatar size={44} />
        <div>
          <h1 className="text-lg font-bold">Đội AI</h1>
          <div className="text-xs text-muted">Văn phòng của bạn</div>
        </div>
      </div>
      {bad && <p className="text-sm text-bad">Sai mật khẩu.</p>}
      <input name="password" type="password" className="input" placeholder="Mật khẩu" autoFocus />
      <button className="btn btn-accent w-full">Vào văn phòng</button>
    </form>
  );
}
