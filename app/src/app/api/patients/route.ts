import { errorResponse, readDb, requireObject, updateDb } from "../../../lib/store";

export const runtime = "nodejs";
export async function GET() { return Response.json((await readDb()).patients); }
export async function POST(request: Request) {
  try {
    const body = requireObject(await request.json());
    const name = String(body.name || "").trim(), phone = String(body.phone || "").trim(), email = String(body.email || "").trim();
    if (name.length < 2 || name.length > 120 || phone.length > 30 || email.length > 254) throw new Error("Dados do paciente inválidos.");
    const patient = await updateDb(db => { const item = { id: crypto.randomUUID(), name, phone, email }; db.patients.push(item); return item; });
    return Response.json(patient, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
