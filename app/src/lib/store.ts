import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type Patient = {
  id: string; name: string; phone: string; email: string;
  birthDate?: string; insurance?: string; notes?: string;
  pregnant?: boolean; dueDate?: string; careType?: string;
  source?: string; referringDoctor?: string; status?: string;
  portalAccessActive?: boolean; createdAt?: string; updatedAt?: string;
};
export const statuses = ["Agendado", "Confirmado", "Realizado", "Cancelado pelo Paciente", "Cancelado pela Fisio", "Não Compareceu"] as const;
export type Status = typeof statuses[number];
export type Session = { id: string; patientId: string; date: string; time: string; duration: number; notes: string; status: Status; recurrenceId?: string; locationId?: string; serviceId?: string };
export type Block = { id: string; date: string; start: string; end: string; reason: string };
export type DayConfig = { active: boolean; start: string; end: string };
export type Config = { days: DayConfig[]; duration: number; capacity: number };
export type Location = { id: string; name: string; address: string; active: boolean };
export type Service = { id: string; name: string; duration: number; active: boolean };
export type Profile = { displayName: string; registration: string; phone: string; email: string };
export type Database = { patients: Patient[]; sessions: Session[]; blocks: Block[]; config: Config; profile: Profile; locations: Location[]; services: Service[]; insurances: string[] };

const dataDir = process.env.FISIOAPP_DATA_DIR || path.join(process.cwd(), ".data");
function fileFor(spaceId: string) {
  if (spaceId === "legacy") return path.join(dataDir, "fisioapp.json");
  if (!/^[a-f0-9]{32}$/.test(spaceId)) throw new Error("Espaço inválido.");
  return path.join(dataDir, "spaces", `${spaceId}.json`);
}
const defaults = (): Database => ({ patients: [], sessions: [], blocks: [], config: { days: Array.from({ length: 7 }, (_, day) => ({ active: day >= 2 && day <= 5, start: "07:00", end: "17:00" })), duration: 60, capacity: 5 }, profile: { displayName: "", registration: "", phone: "", email: "" }, locations: [], services: [], insurances: ["Particular"] });
let queue: Promise<unknown> = Promise.resolve();

export async function readDb(spaceId: string): Promise<Database> {
  try { return { ...defaults(), ...JSON.parse(await readFile(fileFor(spaceId), "utf8")) }; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return defaults(); throw error; }
}

export function updateDb<T>(spaceId: string, change: (db: Database) => T | Promise<T>): Promise<T> {
  const task = queue.then(async () => {
    const db = await readDb(spaceId);
    const result = await change(db);
    const file = fileFor(spaceId);
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    const temp = `${file}.${crypto.randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(db, null, 2), { mode: 0o600 });
    await rename(temp, file);
    return result;
  });
  queue = task.catch(() => undefined);
  return task;
}

export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
export function minutes(value: unknown): number {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return -1;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}
export function dayOf(date: string) { return new Date(`${date}T12:00:00Z`).getUTCDay(); }
export function addDays(date: string, days: number) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
export function active(session: Session) { return !session.status.startsWith("Cancelado") && session.status !== "Não Compareceu"; }
export function checkSession(db: Database, session: Session, excludeId?: string): string | null {
  if (!db.patients.some(p => p.id === session.patientId && p.status !== "Arquivado")) return "Selecione um paciente ativo.";
  if (session.locationId && !db.locations.some(location => location.id === session.locationId && location.active)) return "Local de atendimento inválido.";
  if (session.serviceId && !db.services.some(service => service.id === session.serviceId && service.active)) return "Tipo de atendimento inválido.";
  if (!validDate(session.date) || minutes(session.time) < 0) return "Data ou horário inválido.";
  const start = minutes(session.time), end = start + session.duration;
  const day = db.config.days[dayOf(session.date)];
  if (!day?.active || start < minutes(day.start) || end > minutes(day.end)) return "Horário fora do expediente.";
  if (db.blocks.some(b => b.date === session.date && start < minutes(b.end) && end > minutes(b.start))) return "Horário bloqueado.";
  const overlapping = db.sessions.filter(s => s.id !== excludeId && active(s) && s.date === session.date && start < minutes(s.time) + s.duration && end > minutes(s.time));
  if (overlapping.some(s => s.patientId === session.patientId)) return "Paciente já possui atendimento nesse período.";
  if (overlapping.length >= db.config.capacity) return "Capacidade do horário esgotada.";
  return null;
}

export function errorResponse(error: unknown) { return Response.json({ error: error instanceof Error ? error.message : "Erro inesperado." }, { status: 400 }); }
export function requireObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Dados inválidos.");
  return value as Record<string, unknown>;
}
