import { getPatientLink, noStore } from "../../../lib/platform";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const link = await getPatientLink(new URL(request.url).searchParams.get("token"));
  if (!link) return noStore(Response.json({ error: "Link inválido ou acesso desativado." }, { status: 404 }));
  return noStore(Response.json({ patientName: link.patientName }));
}
