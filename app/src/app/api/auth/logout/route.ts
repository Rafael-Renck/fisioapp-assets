import { cookieHeader, noStore, revokeSession } from "../../../../lib/platform";
export const runtime = "nodejs";
export async function POST(request: Request) { await revokeSession(request); return noStore(Response.json({ ok: true }, { headers: { "Set-Cookie": cookieHeader("", request, 0) } })); }
