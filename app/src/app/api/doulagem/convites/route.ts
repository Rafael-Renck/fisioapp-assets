import { createHash, randomBytes } from "node:crypto";
import { canAccessClinical, getSession, noStore, updatePlatform, forbidden } from "../../../../lib/platform";
import { readDb, requireObject, updateDb } from "../../../../lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session?.space || !canAccessClinical(session.user.role) || session.user.mustChangePassword) return forbidden();
  try {
    const body = requireObject(await request.json());
    const patientId = String(body.patientId || "");
    const patient = (await readDb(session.space.id)).patients.find(item => item.id === patientId && item.status !== "Arquivado" && item.status !== "Alta");
    if (!patient) throw new Error("Selecione uma paciente ativa.");
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await updatePlatform(platform => {
      platform.patientInvites = (platform.patientInvites || []).filter(item => item.patientId !== patientId || item.spaceId !== session.space?.id);
      platform.patientInvites.push({ tokenHash, spaceId: session.space!.id, patientId, expiresAt: Number.MAX_SAFE_INTEGER });
    });
    await updateDb(session.space.id, db => { const item = db.patients.find(entry => entry.id === patientId); if (item) item.portalAccessActive = true; });
    return noStore(Response.json({ path: `/convite/${token}` }));
  } catch (error) { return noStore(Response.json({ error: error instanceof Error ? error.message : "Não foi possível criar o convite." }, { status: 400 })); }
}

export async function PATCH(request: Request) {
  const session = await getSession(request);
  if (!session?.space || !canAccessClinical(session.user.role) || session.user.mustChangePassword) return forbidden();
  try {
    const body = requireObject(await request.json());
    const patientId = String(body.patientId || "");
    await updateDb(session.space.id, db => {
      const patient = db.patients.find(item => item.id === patientId);
      if (!patient) throw new Error("Paciente não encontrada.");
      patient.portalAccessActive = false;
    });
    await updatePlatform(platform => { platform.patientInvites = (platform.patientInvites || []).filter(item => item.patientId !== patientId || item.spaceId !== session.space?.id); });
    return noStore(Response.json({ active: false }));
  } catch (error) { return noStore(Response.json({ error: error instanceof Error ? error.message : "Não foi possível desativar o acesso." }, { status: 400 })); }
}
