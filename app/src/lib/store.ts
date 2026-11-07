import path from "node:path";
import { ensureDailyBackup, readDocument, writeDocument } from "./persistence";

export type Patient = {
  id: string; name: string; phone: string; email: string;
  birthDate?: string; insurance?: string; notes?: string;
  pregnant?: boolean; dueDate?: string; careType?: string;
  source?: string; referringDoctor?: string; status?: string;
  portalAccessActive?: boolean; dischargedAt?: string; createdAt?: string; updatedAt?: string;
};
export function patientIsActive(patient: Patient) { return patient.status !== "Arquivado" && patient.status !== "Alta"; }
export const statuses = ["Agendado", "Confirmado", "Realizado", "Cancelado pelo Paciente", "Cancelado pela Fisio", "Não Compareceu"] as const;
export type Status = typeof statuses[number];
export type PaymentReview = { status: "Conferido" | "Divergente"; amountCents: number | null; reviewedAt: string; reviewedBy: string };
export type Session = { id: string; patientId: string; date: string; time: string; duration: number; notes: string; status: Status; recurrenceId?: string; locationId?: string; serviceId?: string; insurance?: string; authorizationCode?: string; paymentReview?: PaymentReview };
export function isInsuranceSession(session: Pick<Session, "insurance">) { return !!session.insurance && session.insurance.trim().toLocaleLowerCase("pt-BR") !== "particular"; }
export type Block = { id: string; date: string; start: string; end: string; reason: string };
export type DayConfig = { active: boolean; start: string; end: string };
export type Config = { days: DayConfig[]; duration: number; capacity: number };
export type Location = { id: string; name: string; address: string; active: boolean };
export type Service = { id: string; name: string; duration: number; active: boolean };
export type Profile = { displayName: string; registration: string; phone: string; email: string; pixKey?: string; signatureImage?: string };
export type AnamnesisData = { chiefComplaint: string; currentHistory: string; pastHistory: string; medications: string; physicalExam: string; goals: string; proposedTreatment: string; bodyRegions: string };
export type EvolutionData = { date: string; description: string };
export type TreatmentPlanData = { diagnosis: string; startDate: string; reviewDate: string; status: "Ativo" | "Pausado" | "Concluído"; goals: string[]; interventions: { description: string; frequency: string; dosage: string }[] };
export type ClinicalReportData = { title: string; date: string; purpose: string; assessment: string; findings: string; conclusion: string; recommendations: string; professionalName: string; professionalRegistration: string };
export type ClinicalEntry =
  | { id: string; patientId: string; kind: "anamnesis"; createdAt: string; authorId: string; data: AnamnesisData }
  | { id: string; patientId: string; kind: "evolution"; createdAt: string; authorId: string; data: EvolutionData }
  | { id: string; patientId: string; kind: "plan"; createdAt: string; authorId: string; data: TreatmentPlanData }
  | { id: string; patientId: string; kind: "report"; createdAt: string; authorId: string; data: ClinicalReportData };
export type DoulaInstallment = { id: string; dueDate: string; amountCents: number; paidAt: string | null };
export type DoulaService = { description: string; amountCents: number | null };
export type DoulaPaymentAllocation = { method: string; amountCents: number };
export type DoulaDeposit = { amountCents: number; method: string; dueDate?: string; paidAt: string | null };
export type DoulaContract = { id: string; patientId: string; title: string; amountCents: number; createdAt: string; installments: DoulaInstallment[]; services?: DoulaService[]; paymentAllocations?: DoulaPaymentAllocation[]; deposit?: DoulaDeposit; details?: {
  clientName: string; clientCpf: string; clientRg: string; clientAddress: string; clientPhone: string; clientEmail: string;
  doulaName: string; doulaCpf: string; doulaRg: string; doulaAddress: string; doulaPhone: string; doulaEmail: string;
  backupName: string; backupPhone: string; city: string; contractDate: string; paymentMethod: string; pixKey?: string; signatureImage?: string;
} };
export type ContractionMonitoring = { id: string; patientId: string; startedAt: string; endedAt: string | null };
export type Contraction = { id: string; monitoringId: string; startedAt: string; endedAt: string | null; intensity: "Leve" | "Moderada" | "Forte" | null; notes: string };
export type Database = { patients: Patient[]; sessions: Session[]; blocks: Block[]; config: Config; profile: Profile; locations: Location[]; services: Service[]; insurances: string[]; clinicalEntries: ClinicalEntry[]; doulaContracts: DoulaContract[]; contractionMonitorings: ContractionMonitoring[]; contractions: Contraction[] };

const dataDir = process.env.FISIOAPP_DATA_DIR || path.join(process.cwd(), ".data");
function fileFor(spaceId: string) {
  if (spaceId === "legacy") return path.join(dataDir, "fisioapp.json");
  if (!/^[a-f0-9]{32}$/.test(spaceId)) throw new Error("Espaço inválido.");
  return path.join(dataDir, "spaces", `${spaceId}.json`);
}
const defaults = (): Database => ({ patients: [], sessions: [], blocks: [], config: { days: Array.from({ length: 7 }, (_, day) => ({ active: day >= 2 && day <= 5, start: "07:00", end: "17:00" })), duration: 60, capacity: 5 }, profile: { displayName: "", registration: "", phone: "", email: "" }, locations: [], services: [], insurances: ["Particular"], clinicalEntries: [], doulaContracts: [], contractionMonitorings: [], contractions: [] });
let queue: Promise<unknown> = Promise.resolve();

export async function readDb(spaceId: string): Promise<Database> {
  return { ...defaults(), ...(await readDocument<Database>(`space:${spaceId}`, fileFor(spaceId), defaults)).value };
}

export function updateDb<T>(spaceId: string, change: (db: Database) => T | Promise<T>): Promise<T> {
  const task = queue.then(async () => {
    const file = fileFor(spaceId);
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await readDocument<Database>(`space:${spaceId}`, file, defaults);
      const db = { ...defaults(), ...current.value };
      const result = await change(db);
      if (await writeDocument(`space:${spaceId}`, current.version, db)) {
        await ensureDailyBackup().catch(error => console.error("Falha no backup diário:", error));
        return result;
      }
    }
    throw new Error("Os dados foram alterados simultaneamente. Tente novamente.");
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
  if (!db.patients.some(p => p.id === session.patientId && patientIsActive(p))) return "Selecione um paciente ativo.";
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
