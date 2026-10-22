import { checkPassword, createSession, noStore, normalizeEmail, publicUser, readPlatform } from "../../../../lib/platform";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const platform = await readPlatform();
    const user = platform.users.find(item => item.email === normalizeEmail(email));
    if (!user || typeof password !== "string" || !(await checkPassword(password, user))) return noStore(Response.json({ error: "E-mail ou senha inválidos." }, { status: 401 }));
    const space = user.spaceId ? platform.spaces.find(item => item.id === user.spaceId) : undefined;
    if (user.role === "physio" && (!space || space.status !== "active")) return noStore(Response.json({ error: "Este espaço está suspenso. Fale com o responsável pelo sistema." }, { status: 403 }));
    return noStore(Response.json(publicUser(user, space), { headers: { "Set-Cookie": await createSession(user.id, request) } }));
  } catch { return noStore(Response.json({ error: "Não foi possível entrar." }, { status: 400 })); }
}
