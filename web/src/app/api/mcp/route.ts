import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/connections";
import { listTools, callTool } from "@/lib/mcp-tools";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// The one endpoint the office reads the boss's storages through: an MCP server over plain HTTP (JSON-RPC in a POST,
// JSON back), declared on every office with the bearer kept in the boss's vault. Stateless: no session, no stream.

type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };

async function handle(m: Rpc): Promise<unknown> {
  const reply = (result: unknown) => ({ jsonrpc: "2.0", id: m.id ?? null, result });
  switch (m.method) {
    case "initialize":
      return reply({ protocolVersion: String(m.params?.protocolVersion ?? "2025-06-18"), capabilities: { tools: { listChanged: false } }, serverInfo: { name: "doi-ai-nguon", version: "1" } });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: await listTools() });
    case "tools/call": {
      const name = String(m.params?.name ?? "");
      const r = await callTool(name, (m.params?.arguments as Record<string, unknown>) ?? {});
      return reply({ content: [{ type: "text", text: r.text }], ...(r.isError ? { isError: true } : {}) });
    }
    default:
      return { jsonrpc: "2.0", id: m.id ?? null, error: { code: -32601, message: `Method not found: ${m.method}` } };
  }
}

export async function POST(req: Request) {
  if (!(await verifyBearer(req.headers.get("authorization")))) return new NextResponse("unauthorized", { status: 401 });
  let body: Rpc | Rpc[];
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }
  const msgs = Array.isArray(body) ? body : [body];
  const out: unknown[] = [];
  for (const m of msgs) {
    if (m.id === undefined || m.id === null) continue; // a notification (notifications/initialized): nothing to answer
    out.push(await handle(m));
  }
  if (out.length === 0) return new NextResponse(null, { status: 202 });
  return NextResponse.json(Array.isArray(body) ? out : out[0]);
}

export async function GET() {
  return new NextResponse("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}

export async function DELETE() {
  return new NextResponse(null, { status: 200 });
}
