import { readDb } from "../../../lib/store";
import { clinicalSpace, forbidden, noStore } from "../../../lib/platform";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const spaceId = await clinicalSpace(request);
  if (!spaceId) return forbidden();
  const db = await readDb(spaceId);
  const patients = new Map(db.patients.map(item => [item.id, item.name]));
  const services = new Map(db.services.map(item => [item.id, item.name]));
  const locations = new Map(db.locations.map(item => [item.id, item.name]));
  const rows = db.sessions
    .filter(item => item.status === "Realizado" || item.status.startsWith("Cancelado") || item.status === "Não Compareceu")
    .map(item => ({
      id: item.id, date: item.date, time: item.time, patientId: item.patientId,
      patientName: patients.get(item.patientId) || "Paciente não encontrado",
      status: item.status, duration: item.duration, insurance: item.insurance || "", authorizationCode: item.authorizationCode || "", paymentReview: item.paymentReview || null,
      serviceName: item.serviceId ? services.get(item.serviceId) || "Atendimento" : "",
      locationName: item.locationId ? locations.get(item.locationId) || "Local" : "",
    }))
    .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
  return noStore(Response.json({ rows }));
}
