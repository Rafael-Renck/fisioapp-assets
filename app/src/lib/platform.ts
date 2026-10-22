import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const dataDir = process.env.FISIOAPP_DATA_DIR || path.join(process.cwd(), ".data");
const file = path.join(dataDir, "platform.json");
const setupFile = path.join(dataDir, "setup-token");
const cookieName = "fisioapp_session";
const sessionAge = 7 * 24 * 60 * 60;

export type Role = "owner" | "physio";
export type User = { id: string; email: string; salt: string; passwordHash: string; role: Role; spaceId?: string; mustChangePassword?: boolean };
export type Space = { id: string; name: string; plan: string; status: "active" | "suspended"; createdAt: string };
export type PlatformSettings = { brandName: string; supportEmail: string; defaultPlan: string };
export type Platform = { users: User[]; spaces: Space[]; sessions: { tokenHash: string; userId: string; expiresAt: number }[]; settings: PlatformSettings };
const defaults = (): Platform => ({ users: [], spaces: [], sessions: [], settings: { brandName: "FisioApp", supportEmail: "", defaultPlan: "Individual" } });
let queue: Promise<unknown> = Promise.resolve();

export async function readPlatform(): Promise<Platform> {
  try {
    const saved = JSON.parse(await readFile(file, "utf8")) as Platform;
    return { ...defaults(), ...saved, settings: { ...defaults().settings, ...saved.settings } };
  } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return defaults(); throw error; }
}
export function updatePlatform<T>(change: (platform: Platform) => T | Promise<T>): Promise<T> {
  const task = queue.then(async () => {
    const platform = await readPlatform();
    const result = await change(platform);
    await mkdir(dataDir, { recursive: true, mode: 0o700 });
    const temporary = `${file}.${randomBytes(8).toString("hex")}.tmp`;
    await writeFile(temporary, JSON.stringify(platform, null, 2), { mode: 0o600 });
    await rename(temporary, file);
    return result;
  });
  queue = task.catch(() => undefined);
  return task;
}
export function normalizeEmail(value: unknown) { return String(value || "").trim().toLowerCase(); }
export function validEmail(value: string) { return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
export function validPassword(value: unknown): value is string { return typeof value === "string" && value.length >= 12 && value.length <= 256; }
export async function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const passwordHash = (await scrypt(password, salt, 64) as Buffer).toString("hex");
  return { salt, passwordHash };
}
export async function checkPassword(password: string, user: User) {
  const incoming = Buffer.from((await hashPassword(password, user.salt)).passwordHash, "hex");
  const saved = Buffer.from(user.passwordHash, "hex");
  return incoming.length === saved.length && timingSafeEqual(incoming, saved);
}
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export function cookieHeader(token: string, request: Request, maxAge = sessionAge) {
  const secure = request.headers.get("x-forwarded-proto") === "https" || new URL(request.url).protocol === "https:";
  return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}
export function readCookie(request: Request) {
  const value = request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(`${cookieName}=`));
  return value?.slice(cookieName.length + 1) || "";
}
export async function createSession(userId: string, request: Request) {
  const token = randomBytes(32).toString("hex");
  await updatePlatform(platform => {
    platform.sessions = platform.sessions.filter(s => s.expiresAt > Date.now());
    platform.sessions.push({ tokenHash: tokenHash(token), userId, expiresAt: Date.now() + sessionAge * 1000 });
  });
  return cookieHeader(token, request);
}
export async function revokeSession(request: Request) {
  const token = readCookie(request);
  if (token) await updatePlatform(platform => { platform.sessions = platform.sessions.filter(s => s.tokenHash !== tokenHash(token)); });
}
export async function getSession(request: Request): Promise<{ user: User; space?: Space } | null> {
  const token = readCookie(request);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const platform = await readPlatform();
  const session = platform.sessions.find(s => s.tokenHash === tokenHash(token) && s.expiresAt > Date.now());
  if (!session) return null;
  let user = platform.users.find(u => u.id === session.userId);
  if (!user) return null;
  const currentSpaceId = user.spaceId;
  let space = currentSpaceId ? platform.spaces.find(s => s.id === currentSpaceId) : undefined;
  if (user.role === "owner" && !space) {
    const ownerId = user.id;
    const migrated = await updatePlatform(current => {
      const owner = current.users.find(item => item.id === ownerId);
      if (!owner) throw new Error("Conta não encontrada.");
      let ownSpace = current.spaces.find(item => item.id === owner.spaceId);
      if (!ownSpace) {
        ownSpace = { id: randomBytes(16).toString("hex"), name: "Meu consultório", plan: "Administrador", status: "active", createdAt: new Date().toISOString() };
        current.spaces.push(ownSpace);
        owner.spaceId = ownSpace.id;
      }
      return { owner, ownSpace };
    });
    user = migrated.owner;
    space = migrated.ownSpace;
  }
  if (user.role === "physio" && (!space || space.status !== "active")) return null;
  return { user, space };
}
export function publicUser(user: User, space?: Space) { return { id: user.id, email: user.email, role: user.role, spaceId: user.spaceId, spaceName: space?.name, mustChangePassword: !!user.mustChangePassword }; }
export async function physioSpace(request: Request) {
  const session = await getSession(request);
  return session && !session.user.mustChangePassword ? session.space?.id || null : null;
}
export async function settingsSpace(request: Request) {
  const session = await getSession(request);
  return session?.space?.id || null;
}
export function forbidden() { return noStore(Response.json({ error: "Acesso não autorizado." }, { status: 401 })); }
export async function ensureSetupToken() {
  if ((await readPlatform()).users.some(user => user.role === "owner")) return false;
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  try { await writeFile(setupFile, randomBytes(24).toString("hex"), { flag: "wx", mode: 0o600 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  return true;
}
export async function createOwner(token: string, email: string, password: string) {
  email = normalizeEmail(email);
  if (!validEmail(email) || !validPassword(password)) throw new Error("Informe um e-mail válido e uma senha de pelo menos 12 caracteres.");
  await ensureSetupToken();
  const saved = (await readFile(setupFile, "utf8")).trim();
  const candidate = Buffer.from(token);
  const expected = Buffer.from(saved);
  if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) throw new Error("Código de instalação inválido.");
  const credentials = await hashPassword(password);
  const user = await updatePlatform(platform => {
    if (platform.users.some(item => item.role === "owner")) throw new Error("A conta do dono já foi criada.");
    const space: Space = { id: randomBytes(16).toString("hex"), name: "Meu consultório", plan: "Administrador", status: "active", createdAt: new Date().toISOString() };
    const item: User = { id: randomBytes(16).toString("hex"), email, ...credentials, role: "owner", spaceId: space.id };
    platform.spaces.push(space);
    platform.users.push(item);
    return item;
  });
  await unlink(setupFile).catch(() => undefined);
  return user;
}
export function noStore(response: Response) { response.headers.set("Cache-Control", "no-store"); return response; }
