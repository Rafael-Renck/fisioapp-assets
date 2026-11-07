import { errorResponse, readDb, requireObject, updateDb, type Contraction, type ContractionMonitoring, type Database } from "../../../lib/store";
import { canAccessClinical, forbidden, getPatientLink, getSession, noStore } from "../../../lib/platform";

export const runtime = "nodejs";

type Context = { spaceId: string; patientId: string };
async function context(request: Request, requestedPatientId: unknown): Promise<Context | null> {
  if (request.headers.has("x-patient-link")) {
    const link = await getPatientLink(request.headers.get("x-patient-link"));
    return link ? { spaceId: link.spaceId, patientId: link.patientId } : null;
  }
  const session = await getSession(request);
  if (!session?.space || session.user.mustChangePassword) return null;
  if (session.user.role !== "patient" && !canAccessClinical(session.user.role)) return null;
  const patientId = session.user.role === "patient" ? session.user.patientId : requestedPatientId;
  if (typeof patientId !== "string" || !patientId) return null;
  const patient = (await readDb(session.space.id)).patients.find(item => item.id === patientId && item.status !== "Arquivado" && item.status !== "Alta");
  return patient ? { spaceId: session.space.id, patientId } : null;
}
function snapshot(db: Database, patientId: string) {
  const monitorings = db.contractionMonitorings.filter(item => item.patientId === patientId).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const ids = new Set(monitorings.map(item => item.id));
  return { monitorings, contractions: db.contractions.filter(item => ids.has(item.monitoringId)).sort((a, b) => b.startedAt.localeCompare(a.startedAt)) };
}
function iso(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
}
function overlaps(db: Database, monitoringId: string, startedAt: string, endedAt: string, excludeId: string) {
  return db.contractions.some(item => item.monitoringId === monitoringId && item.id !== excludeId && startedAt < (item.endedAt || "9999") && endedAt > item.startedAt);
}

export async function GET(request: Request) {
  const patientId = new URL(request.url).searchParams.get("patientId");
  const access = await context(request, patientId);
  if (!access) return forbidden();
  return noStore(Response.json(snapshot(await readDb(access.spaceId), access.patientId)));
}

export async function POST(request: Request) {
  try {
    const body = requireObject(await request.json());
    const access = await context(request, body.patientId);
    if (!access) return forbidden();
    const result = await updateDb(access.spaceId, db => {
      const now = new Date().toISOString();
      if (body.action === "start") {
        let monitoring = db.contractionMonitorings.find(item => item.patientId === access.patientId && !item.endedAt);
        if (!monitoring) {
          monitoring = { id: crypto.randomUUID(), patientId: access.patientId, startedAt: now, endedAt: null } satisfies ContractionMonitoring;
          db.contractionMonitorings.push(monitoring);
        }
        if (db.contractions.some(item => item.monitoringId === monitoring.id && !item.endedAt)) throw new Error("Já há uma contração em andamento.");
        db.contractions.push({ id: crypto.randomUUID(), monitoringId: monitoring.id, startedAt: now, endedAt: null, intensity: null, notes: "" } satisfies Contraction);
      } else if (body.action === "stop") {
        const item = db.contractions.find(entry => entry.id === body.id && !entry.endedAt && db.contractionMonitorings.some(run => run.id === entry.monitoringId && run.patientId === access.patientId && !run.endedAt));
        if (!item) throw new Error("Contração em andamento não encontrada.");
        item.endedAt = now;
      } else if (body.action === "finish") {
        const monitoring = db.contractionMonitorings.find(item => item.patientId === access.patientId && !item.endedAt);
        if (!monitoring) throw new Error("Nenhum acompanhamento em andamento.");
        if (db.contractions.some(item => item.monitoringId === monitoring.id && !item.endedAt)) throw new Error("Encerre a contração antes de finalizar o acompanhamento.");
        monitoring.endedAt = now;
      } else throw new Error("Ação inválida.");
      return snapshot(db, access.patientId);
    });
    return noStore(Response.json(result));
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const body = requireObject(await request.json());
    const access = await context(request, body.patientId);
    if (!access) return forbidden();
    if (!iso(body.startedAt) || !iso(body.endedAt) || body.endedAt <= body.startedAt || Date.parse(body.endedAt) > Date.now() + 60_000) throw new Error("Revise o início e o fim da contração.");
    if (![null, "Leve", "Moderada", "Forte"].includes(body.intensity as string | null) || typeof body.notes !== "string" || body.notes.trim().length > 500) throw new Error("Intensidade ou observação inválida.");
    const startedAt = body.startedAt as string, endedAt = body.endedAt as string, notes = body.notes as string;
    const result = await updateDb(access.spaceId, db => {
      const item = db.contractions.find(entry => entry.id === body.id);
      const monitoring = db.contractionMonitorings.find(run => run.id === item?.monitoringId && run.patientId === access.patientId);
      if (!item || !monitoring || !item.endedAt) throw new Error("Contração concluída não encontrada.");
      if ((monitoring.endedAt && endedAt > monitoring.endedAt) || overlaps(db, monitoring.id, startedAt, endedAt, item.id)) throw new Error("Os horários se sobrepõem a outra contração ou estão fora do acompanhamento.");
      item.startedAt = startedAt;
      item.endedAt = endedAt;
      item.intensity = body.intensity as Contraction["intensity"];
      item.notes = notes.trim();
      monitoring.startedAt = db.contractions.filter(entry => entry.monitoringId === monitoring.id).reduce((earliest, entry) => entry.startedAt < earliest ? entry.startedAt : earliest, startedAt);
      return snapshot(db, access.patientId);
    });
    return noStore(Response.json(result));
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    const body = requireObject(await request.json());
    const access = await context(request, body.patientId);
    if (!access) return forbidden();
    const result = await updateDb(access.spaceId, db => {
      const index = db.contractions.findIndex(item => item.id === body.id && !!item.endedAt && db.contractionMonitorings.some(run => run.id === item.monitoringId && run.patientId === access.patientId));
      if (index < 0) throw new Error("Contração concluída não encontrada.");
      const [removed] = db.contractions.splice(index, 1);
      const monitoring = db.contractionMonitorings.find(item => item.id === removed.monitoringId)!;
      const remaining = db.contractions.filter(item => item.monitoringId === removed.monitoringId);
      if (remaining.length) monitoring.startedAt = remaining.reduce((earliest, item) => item.startedAt < earliest ? item.startedAt : earliest, remaining[0].startedAt);
      return snapshot(db, access.patientId);
    });
    return noStore(Response.json(result));
  } catch (error) { return errorResponse(error); }
}
