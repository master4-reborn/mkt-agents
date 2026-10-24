import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { officeStatus } from "@/lib/office";
import { sync, lastStopReason } from "@/lib/sync";

export const dynamic = "force-dynamic";

// Polled by the page while the team is working: pulls new files and messages, returns the status.
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await sync();
  const s = await officeStatus();
  return NextResponse.json({ ...s, stopReason: await lastStopReason() });
}
