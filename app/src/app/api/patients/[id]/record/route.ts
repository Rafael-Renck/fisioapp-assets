import { randomUUID } from "node:crypto";
import { parseAnamnesis, parseEvolution, parsePlan } from "../../../../../lib/clinical";
import { getSession, noStore } from "../../../../../lib/platform";
import { readDb, updateDb, type ClinicalEntry } from "../../../../../lib/store";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const denied = () => noStore(Response.json({ error: "Acesso não autorizado." }, { status: 401 }));
const missing = () => noStore(Response.json({ error: "Paciente não encontrado." }, { status: 404 }));

export async function GET(request: Request, context: Context) {
  const session = await getSession(request);
  if (!session?.space || session.user.mustChangePassword) return denied();
  const { id } = await context.params;
  const db = await readDb(session.space.id);
  const patient = db.patients.find(item => item.id === id);
  if (!patient) return missing();
  const entries = db.clinicalEntries.filter(item => item.patientId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const appointments = db.sessions.filter(item => item.patientId === id).sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
  return noStore(Response.json({ patient, entries, appointments, locations: db.locations, services: db.services }));
}

export async function POST(request: Request, context: Context) {
  const session = await getSession(request);
  if (!session?.space || session.user.mustChangePassword) return denied();
  const { id } = await context.params;
  try {
    const body = await request.json();
    const kind = body?.kind;
    if (!["anamnesis", "evolution", "plan"].includes(kind)) throw new Error("Tipo de registro inválido.");
    const data = kind === "anamnesis" ? parseAnamnesis(body.data) : kind === "evolution" ? parseEvolution(body.data) : parsePlan(body.data);
    const entry = await updateDb(session.space.id, db => {
      const patient = db.patients.find(item => item.id === id);
      if (!patient) throw new Error("Paciente não encontrado.");
      if (patient.status === "Arquivado") throw new Error("Reative o paciente antes de registrar novas informações.");
      const base = { id: randomUUID(), patientId: id, createdAt: new Date().toISOString(), authorId: session.user.id };
      const item = (kind === "anamnesis" ? { ...base, kind, data } : kind === "evolution" ? { ...base, kind, data } : { ...base, kind, data }) as ClinicalEntry;
      db.clinicalEntries.push(item);
      return item;
    });
    return noStore(Response.json(entry, { status: 201 }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível salvar o registro.";
    return noStore(Response.json({ error: message }, { status: message === "Paciente não encontrado." ? 404 : 400 }));
  }
}
