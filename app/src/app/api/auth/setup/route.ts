import { createOwner, createSession, ensureSetupToken, noStore, readPlatform } from "../../../../lib/platform";
export const runtime = "nodejs";
export async function GET() { return noStore(Response.json({ needed: await ensureSetupToken() })); }
export async function POST(request: Request) {
  try {
    const { token, email, password } = await request.json();
    const user = await createOwner(String(token || ""), String(email || ""), password);
    return noStore(Response.json({ role: user.role }, { headers: { "Set-Cookie": await createSession(user.id, request) } }));
  } catch (error) {
    const exists = (await readPlatform()).users.some(user => user.role === "owner");
    return noStore(Response.json({ error: exists ? "A instalação já foi concluída." : error instanceof Error ? error.message : "Erro na instalação." }, { status: exists ? 409 : 400 }));
  }
}
