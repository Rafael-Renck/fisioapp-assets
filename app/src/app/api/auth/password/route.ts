import { checkPassword, getSession, hashPassword, noStore, updatePlatform, validPassword } from "../../../../lib/platform";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const session = await getSession(request); if (!session) return noStore(Response.json({ error: "Acesso não autorizado." }, { status: 401 }));
  try {
    const { currentPassword, newPassword } = await request.json();
    if (typeof currentPassword !== "string" || !(await checkPassword(currentPassword, session.user))) throw new Error("Senha atual incorreta.");
    if (!validPassword(newPassword)) throw new Error("A nova senha deve ter entre 12 e 256 caracteres.");
    const credentials = await hashPassword(newPassword);
    await updatePlatform(platform => { const user = platform.users.find(item => item.id === session.user.id); if (!user) throw new Error("Conta não encontrada."); Object.assign(user, credentials, { mustChangePassword: false }); });
    return noStore(Response.json({ ok: true }));
  } catch (error) { return noStore(Response.json({ error: error instanceof Error ? error.message : "Erro ao trocar senha." }, { status: 400 })); }
}
