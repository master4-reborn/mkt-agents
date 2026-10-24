import { loginAction } from "../actions";

export default async function Login({ searchParams }: { searchParams: Promise<{ bad?: string }> }) {
  const { bad } = await searchParams;
  return (
    <form action={loginAction} className="card mx-auto mt-10 max-w-sm space-y-3">
      <h1 className="text-lg font-semibold">Đăng nhập</h1>
      {bad && <p className="text-sm text-red-700">Sai mật khẩu.</p>}
      <input name="password" type="password" className="input" placeholder="Mật khẩu" autoFocus />
      <button className="btn-primary w-full">Vào văn phòng</button>
    </form>
  );
}
