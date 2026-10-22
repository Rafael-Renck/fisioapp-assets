import { getSession, noStore, publicUser } from "../../../../lib/platform";
export const runtime = "nodejs";
export async function GET(request: Request) { const session = await getSession(request); return noStore(Response.json(session ? publicUser(session.user, session.space) : null, { status: session ? 200 : 401 })); }
