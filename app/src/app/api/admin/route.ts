import { randomBytes } from "node:crypto";
import { access } from "node:fs/promises";
import path from "node:path";
import { getSession, hashPassword, noStore, normalizeEmail, readPlatform, updatePlatform, validEmail, validPassword, type Space, type User } from "../../../lib/platform";
export const runtime = "nodejs";
async function owner(request: Request) { return (await getSession(request))?.user.role === "owner"; }
const denied = () => noStore(Response.json({ error: "Acesso exclusivo do dono do sistema." }, { status: 403 }));
export async function GET(request: Request) {
  if (!await owner(request)) return denied();
  const platform = await readPlatform();
  const legacyFile = path.join(process.env.FISIOAPP_DATA_DIR || path.join(process.cwd(), ".data"), "fisioapp.json");
  const legacyAvailable = !platform.spaces.some(space => space.id === "legacy") && await access(legacyFile).then(() => true, () => false);
  return noStore(Response.json({ settings: platform.settings, spaces: platform.spaces.filter(space => platform.users.some(user => user.role === "physio" && user.spaceId === space.id)).map(space => ({ ...space, email: platform.users.find(user => user.role === "physio" && user.spaceId === space.id)?.email || "" })), legacyAvailable }));
}
export async function POST(request: Request) {
  if (!await owner(request)) return denied();
  try {
    const body = await request.json();
    const name = String(body.name || "").trim(), email = normalizeEmail(body.email), password = body.password;
    if (!name || name.length > 120 || !validEmail(email) || !validPassword(password)) throw new Error("Informe nome, e-mail válido e senha temporária de pelo menos 12 caracteres.");
    if (body.useLegacyData) {
      const legacyFile = path.join(process.env.FISIOAPP_DATA_DIR || path.join(process.cwd(), ".data"), "fisioapp.json");
      if (!await access(legacyFile).then(() => true, () => false)) throw new Error("Não há dados antigos para atribuir.");
    }
    const credentials = await hashPassword(password);
    const space = await updatePlatform(platform => {
      if (platform.users.some(user => user.email === email)) throw new Error("Este e-mail já está cadastrado.");
      if (body.useLegacyData && platform.spaces.some(item => item.id === "legacy")) throw new Error("Os dados antigos já foram atribuídos.");
      const item: Space = { id: body.useLegacyData ? "legacy" : randomBytes(16).toString("hex"), name, plan: platform.settings.defaultPlan, status: "active", createdAt: new Date().toISOString() };
      const user: User = { id: randomBytes(16).toString("hex"), email, ...credentials, role: "physio", spaceId: item.id, mustChangePassword: true };
      platform.spaces.push(item); platform.users.push(user); return item;
    });
    return noStore(Response.json(space, { status: 201 }));
  } catch (error) { return noStore(Response.json({ error: error instanceof Error ? error.message : "Erro ao criar espaço." }, { status: 400 })); }
}
export async function PATCH(request: Request) {
  if (!await owner(request)) return denied();
  try {
    const body = await request.json();
    const result = await updatePlatform(platform => {
      if (body.action === "settings") {
        const brandName = String(body.brandName || "").trim(), supportEmail = String(body.supportEmail || "").trim(), defaultPlan = String(body.defaultPlan || "").trim();
        if (!brandName || brandName.length > 80 || supportEmail && !validEmail(supportEmail) || !defaultPlan || defaultPlan.length > 80) throw new Error("Configurações gerais inválidas.");
        platform.settings = { brandName, supportEmail, defaultPlan }; return platform.settings;
      }
      if (body.action === "space") {
        const space = platform.spaces.find(item => item.id === body.id && platform.users.some(user => user.role === "physio" && user.spaceId === item.id)); if (!space) throw new Error("Espaço não encontrado.");
        const name = String(body.name || "").trim(), plan = String(body.plan || "").trim();
        if (!name || name.length > 120 || !plan || plan.length > 80 || !["active", "suspended"].includes(body.status)) throw new Error("Dados do espaço inválidos.");
        Object.assign(space, { name, plan, status: body.status });
        if (body.status === "suspended") platform.sessions = platform.sessions.filter(session => !platform.users.some(user => user.spaceId === space.id && user.id === session.userId));
        return space;
      }
      throw new Error("Ação desconhecida.");
    });
    return noStore(Response.json(result));
  } catch (error) { return noStore(Response.json({ error: error instanceof Error ? error.message : "Erro ao atualizar." }, { status: 400 })); }
}
