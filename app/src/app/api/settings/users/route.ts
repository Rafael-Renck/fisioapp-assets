import { randomBytes } from "node:crypto";
import { getSession, hashPassword, isManager, noStore, normalizeEmail, readPlatform, updatePlatform, validEmail, type TeamRole, type User } from "../../../../lib/platform";

export const runtime = "nodejs";

async function manager(request: Request) {
  const session = await getSession(request);
  return session?.space && !session.user.mustChangePassword && isManager(session.user.role) ? session : null;
}
const teamRoles: TeamRole[] = ["admin", "therapist", "reception"];
const editable = (role: User["role"]) => teamRoles.includes(role as TeamRole) || role === "staff";
const denied = () => noStore(Response.json({ error: "Apenas administradores podem gerenciar usuários." }, { status: 403 }));
const fail = (error: unknown) => noStore(Response.json({ error: error instanceof Error ? error.message : "Não foi possível atualizar o usuário." }, { status: 400 }));
const view = (user: User) => ({ id: user.id, name: user.name || "", email: user.email, role: user.role, active: user.active !== false, mustChangePassword: !!user.mustChangePassword, createdAt: user.createdAt || null });

export async function GET(request: Request) {
  const session = await manager(request);
  if (!session) return denied();
  const platform = await readPlatform();
  return noStore(Response.json({ users: platform.users.filter(user => user.spaceId === session.space!.id && user.role !== "patient").map(view), currentUserId: session.user.id }));
}

export async function POST(request: Request) {
  const session = await manager(request);
  if (!session) return denied();
  try {
    const body = await request.json();
    const name = String(body.name || "").trim(), email = normalizeEmail(body.email), role = body.role as TeamRole;
    if (name.length < 2 || name.length > 120 || !validEmail(email)) throw new Error("Informe nome e e-mail válidos.");
    if (!teamRoles.includes(role)) throw new Error("Selecione um perfil válido.");
    const temporaryPassword = randomBytes(18).toString("base64url");
    const credentials = await hashPassword(temporaryPassword);
    const user = await updatePlatform(platform => {
      if (platform.users.some(item => item.email === email)) throw new Error("Este e-mail já está cadastrado.");
      const item: User = { id: randomBytes(16).toString("hex"), name, email, ...credentials, role, spaceId: session.space!.id, active: true, createdAt: new Date().toISOString(), mustChangePassword: true };
      platform.users.push(item);
      return item;
    });
    return noStore(Response.json({ user: view(user), temporaryPassword }, { status: 201 }));
  } catch (error) { return fail(error); }
}

export async function PATCH(request: Request) {
  const session = await manager(request);
  if (!session) return denied();
  try {
    const body = await request.json();
    let temporaryPassword: string | undefined;
    let credentials: Awaited<ReturnType<typeof hashPassword>> | undefined;
    if (body.action === "resetPassword") {
      temporaryPassword = randomBytes(18).toString("base64url");
      credentials = await hashPassword(temporaryPassword);
    }
    const user = await updatePlatform(platform => {
      const item = platform.users.find(entry => entry.id === body.id && entry.spaceId === session.space!.id && editable(entry.role));
      if (!item) throw new Error("Usuário da equipe não encontrado.");
      if (item.id === session.user.id && body.action !== "edit") throw new Error("Use Segurança da conta para alterar seu próprio acesso.");
      if (body.action === "edit") {
        const name = String(body.name || "").trim(), email = normalizeEmail(body.email);
        const role = body.role as TeamRole;
        if (name.length < 2 || name.length > 120 || !validEmail(email)) throw new Error("Informe nome e e-mail válidos.");
        if (!teamRoles.includes(role)) throw new Error("Selecione um perfil válido.");
        if (item.id === session.user.id && role !== item.role) throw new Error("Você não pode alterar seu próprio perfil.");
        if (platform.users.some(entry => entry.email === email && entry.id !== item.id)) throw new Error("Este e-mail já está cadastrado.");
        item.name = name; item.email = email; item.role = role;
        platform.sessions = platform.sessions.filter(entry => entry.userId !== item.id);
      } else if (body.action === "setActive") {
        if (typeof body.active !== "boolean") throw new Error("Estado do usuário inválido.");
        item.active = body.active;
        if (!body.active) platform.sessions = platform.sessions.filter(entry => entry.userId !== item.id);
      } else if (body.action === "resetPassword" && credentials) {
        Object.assign(item, credentials, { mustChangePassword: true });
        platform.sessions = platform.sessions.filter(entry => entry.userId !== item.id);
      } else throw new Error("Ação inválida.");
      return item;
    });
    return noStore(Response.json({ user: view(user), ...(temporaryPassword ? { temporaryPassword } : {}) }));
  } catch (error) { return fail(error); }
}
