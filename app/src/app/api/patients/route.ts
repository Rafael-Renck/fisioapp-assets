import { errorResponse, readDb, requireObject, updateDb, validDate, type Patient } from "../../../lib/store";
import { canAccessClinical, forbidden, getSession, physioSpace, updatePlatform } from "../../../lib/platform";

export const runtime = "nodejs";

function patientFields(body: Record<string, unknown>): Omit<Patient, "id" | "createdAt" | "updatedAt" | "portalAccessActive" | "dischargedAt" | "status"> {
  const name = String(body.name || "").trim(), email = String(body.email || "").trim();
  const phone = String(body.phone || "").trim(), birthDate = String(body.birthDate || "");
  const insurance = String(body.insurance || "").trim(), notes = String(body.notes || "").trim();
  const pregnant = body.pregnant === true, dueDate = String(body.dueDate || "");
  const careType = String(body.careType || "Default").trim() || "Default";
  const source = String(body.source || "").trim(), referringDoctor = String(body.referringDoctor || "").trim();
  if (name.length < 2 || name.length > 120 || email.length > 254 ||
      (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || phone.length > 30 ||
      insurance.length > 120 || notes.length > 2000 || careType.length > 120 ||
      source.length > 120 || referringDoctor.length > 120 ||
      (birthDate && !validDate(birthDate)) || (dueDate && !validDate(dueDate)) ||
      (!pregnant && dueDate)) throw new Error("Informe um nome válido e revise os demais campos.");
  return { name, email, phone, birthDate, insurance, notes, pregnant, dueDate, careType, source, referringDoctor };
}

export async function GET(request: Request) { const spaceId = await physioSpace(request); if (!spaceId) return forbidden(); return Response.json((await readDb(spaceId)).patients, { headers: { "Cache-Control": "no-store" } }); }

export async function POST(request: Request) {
  const spaceId = await physioSpace(request); if (!spaceId) return forbidden();
  try {
    const fields = patientFields(requireObject(await request.json()));
    const patient = await updateDb(spaceId, db => {
      const number = db.patients.reduce((highest, item) => {
        const match = /^FPAC(\d+)$/.exec(item.id);
        return match ? Math.max(highest, Number(match[1])) : highest;
      }, 0) + 1;
      const now = new Date().toISOString();
      const item: Patient = { id: `FPAC${String(number).padStart(3, "0")}`, ...fields, status: "", portalAccessActive: false, createdAt: now, updatedAt: now };
      db.patients.push(item); return item;
    });
    return Response.json(patient, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request) {
  const spaceId = await physioSpace(request); if (!spaceId) return forbidden();
  try {
    const body = requireObject(await request.json());
    const fields = patientFields(body);
    const patient = await updateDb(spaceId, db => {
      const item = db.patients.find(p => p.id === body.id);
      if (!item) throw new Error("Paciente não encontrado.");
      Object.assign(item, fields, { updatedAt: new Date().toISOString() });
      return item;
    });
    return Response.json(patient);
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  const spaceId = await physioSpace(request); if (!spaceId) return forbidden();
  try {
    const body = requireObject(await request.json());
    const changingArchive = typeof body.archived === "boolean";
    const changingDischarge = typeof body.discharged === "boolean";
    if (changingDischarge && !canAccessClinical((await getSession(request))!.user.role)) return forbidden();
    if (changingArchive === changingDischarge) throw new Error("Informe uma alteração de estado válida.");
    const patient = await updateDb(spaceId, db => {
      const item = db.patients.find(p => p.id === body.id);
      if (!item) throw new Error("Paciente não encontrado.");
      if (changingDischarge) {
        if (body.discharged && item.status === "Arquivado") throw new Error("Reative o cadastro antes de dar alta.");
        if (body.discharged && item.status !== "Alta") {
          db.sessions = db.sessions.filter(session => session.patientId !== item.id || session.status === "Realizado");
          item.portalAccessActive = false;
          item.dischargedAt = new Date().toISOString();
        }
        if (!body.discharged && item.status !== "Alta") throw new Error("A paciente não está com alta.");
        if (!body.discharged) item.dischargedAt = undefined;
        item.status = body.discharged ? "Alta" : "";
      } else {
        if (body.archived && item.status === "Alta") throw new Error("Reative a paciente antes de arquivar.");
        item.status = body.archived ? "Arquivado" : "";
      }
      item.updatedAt = new Date().toISOString();
      return item;
    });
    if (changingDischarge && body.discharged) await updatePlatform(platform => {
      platform.patientInvites = (platform.patientInvites || []).filter(item => item.spaceId !== spaceId || item.patientId !== patient.id);
    });
    return Response.json(patient);
  } catch (error) { return errorResponse(error); }
}
