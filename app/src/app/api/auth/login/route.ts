import { checkPassword, createSession, noStore, normalizeEmail, publicUser, readPlatform } from "../../../../lib/platform";
import { readDb } from "../../../../lib/store";
import { clearLoginFailures, loginBlocked, recordLoginFailure } from "../../../../lib/persistence";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const normalizedEmail = normalizeEmail(email);
    if (await loginBlocked(normalizedEmail)) return noStore(Response.json({ error: "Muitas tentativas de acesso. Tente novamente em 15 minutos." }, { status: 429 }));
    const platform = await readPlatform();
    const user = platform.users.find(item => item.email === normalizedEmail);
    if (!user || typeof password !== "string" || !(await checkPassword(password, user))) {
      await recordLoginFailure(normalizedEmail);
      return noStore(Response.json({ error: "E-mail ou senha inválidos." }, { status: 401 }));
    }
    await clearLoginFailures(normalizedEmail);
    if (user.active === false) return noStore(Response.json({ error: "Este usuário está desativado." }, { status: 403 }));
    const space = user.spaceId ? platform.spaces.find(item => item.id === user.spaceId) : undefined;
    if (user.role !== "owner" && (!space || space.status !== "active")) return noStore(Response.json({ error: "Este espaço está suspenso. Fale com o responsável pelo sistema." }, { status: 403 }));
    if (user.role === "patient") {
      const patient = space && user.patientId ? (await readDb(space.id)).patients.find(item => item.id === user.patientId) : null;
      if (!patient || (patient.status === "Arquivado" || patient.status === "Alta") || !patient.portalAccessActive) return noStore(Response.json({ error: "Acesso da paciente indisponível." }, { status: 403 }));
    }
    return noStore(Response.json(publicUser(user, space), { headers: { "Set-Cookie": await createSession(user.id, request) } }));
  } catch { return noStore(Response.json({ error: "Não foi possível entrar." }, { status: 400 })); }
}
