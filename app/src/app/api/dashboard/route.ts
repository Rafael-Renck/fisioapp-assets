import { canAccessClinical, forbidden, getSession, noStore } from "../../../lib/platform";
import { patientIsActive, readDb, type Session } from "../../../lib/store";

export const runtime = "nodejs";

const inSaoPaulo = (date: Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", ...options }).format(date);

export async function GET(request: Request) {
  const access = await getSession(request);
  if (!access?.space || access.user.role === "patient" || access.user.mustChangePassword) return forbidden();

  const db = await readDb(access.space.id);
  const now = new Date();
  const today = inSaoPaulo(now, { year: "numeric", month: "2-digit", day: "2-digit" });
  const currentTime = inSaoPaulo(now, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const patients = new Map(db.patients.map(patient => [patient.id, patient]));
  const services = new Map(db.services.map(service => [service.id, service.name]));
  const clinical = canAccessClinical(access.user.role);
  const evolutionDates = new Set(clinical ? db.clinicalEntries
    .filter(entry => entry.kind === "evolution")
    .map(entry => `${entry.patientId}:${entry.data.date}`) : []);
  const summarize = (session: Session) => ({
    id: session.id, patientId: session.patientId,
    patientName: patients.get(session.patientId)?.name || "Paciente não encontrado",
    patientActive: !!patients.get(session.patientId) && patientIsActive(patients.get(session.patientId)!),
    date: session.date, time: session.time, duration: session.duration, status: session.status,
    serviceName: session.serviceId ? services.get(session.serviceId) || "Atendimento" : "Atendimento",
    hasEvolution: evolutionDates.has(`${session.patientId}:${session.date}`),
  });
  const sessions = db.sessions.filter(session => session.date === today).sort((a, b) => a.time.localeCompare(b.time)).map(summarize);
  const pendingSessions = db.sessions.filter(session => {
    if (session.date > today) return false;
    if (!patients.get(session.patientId) || !patientIsActive(patients.get(session.patientId)!)) return false;
    const past = session.date < today || (session.date === today && session.time < currentTime);
    return (past && (session.status === "Agendado" || session.status === "Confirmado")) ||
      (clinical && session.status === "Realizado" && !evolutionDates.has(`${session.patientId}:${session.date}`));
  }).sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
  const pending = pendingSessions.slice(0, 10).map(session => ({
    ...summarize(session), kind: session.status === "Realizado" ? "evolution" as const : "outcome" as const,
  }));
  return noStore(Response.json({
    today, currentTime, canAccessClinical: clinical, sessions, pending,
    totals: { today: sessions.length, unconfirmed: sessions.filter(session => session.status === "Agendado" && session.patientActive).length, pending: pendingSessions.length },
  }));
}
