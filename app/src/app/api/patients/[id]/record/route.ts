import { randomUUID } from "node:crypto";
import { parseAnamnesis, parseClinicalReport, parseEvolution, parsePlan } from "../../../../../lib/clinical";
import { canAccessClinical, getSession, noStore } from "../../../../../lib/platform";
import { readDb, updateDb, type ClinicalEntry } from "../../../../../lib/store";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const denied = () => noStore(Response.json({ error: "Acesso não autorizado." }, { status: 401 }));
const missing = () => noStore(Response.json({ error: "Paciente não encontrado." }, { status: 404 }));

export async function GET(request: Request, context: Context) {
  const session = await getSession(request);
  if (!session?.space || session.user.mustChangePassword || !canAccessClinical(session.user.role)) return denied();
  const { id } = await context.params;
  const db = await readDb(session.space.id);
  const patient = db.patients.find(item => item.id === id);
  if (!patient) return missing();
  const entries = db.clinicalEntries.filter(item => item.patientId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const appointments = db.sessions.filter(item => item.patientId === id).sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
  return noStore(Response.json({ patient, entries, appointments, locations: db.locations, services: db.services, profile: db.profile, currentUserName: session.user.name || "" }));
}

export async function POST(request: Request, context: Context) {
  const session = await getSession(request);
  if (!session?.space || session.user.mustChangePassword || !canAccessClinical(session.user.role)) return denied();
  const { id } = await context.params;
  try {
    const body = await request.json();
    const kind = body?.kind;
    if (!["anamnesis", "evolution", "plan", "report"].includes(kind)) throw new Error("Tipo de registro inválido.");
    const data = kind === "anamnesis" ? parseAnamnesis(body.data) : kind === "evolution" ? parseEvolution(body.data) : kind === "plan" ? parsePlan(body.data) : parseClinicalReport(body.data);
    const entry = await updateDb(session.space.id, db => {
      const patient = db.patients.find(item => item.id === id);
      if (!patient) throw new Error("Paciente não encontrado.");
      if ((patient.status === "Arquivado" || patient.status === "Alta")) throw new Error("Reative o paciente antes de registrar novas informações.");
      const base = { id: randomUUID(), patientId: id, createdAt: new Date().toISOString(), authorId: session.user.id };
      const item = { ...base, kind, data } as ClinicalEntry;
      db.clinicalEntries.push(item);
      return item;
    });
    return noStore(Response.json(entry, { status: 201 }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível salvar o registro.";
    return noStore(Response.json({ error: message }, { status: message === "Paciente não encontrado." ? 404 : 400 }));
  }
}
