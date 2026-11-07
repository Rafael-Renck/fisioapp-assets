import { clinicalSpace, forbidden, noStore } from "../../../../lib/platform";
import { errorResponse, readDb, requireObject, updateDb } from "../../../../lib/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const spaceId = await clinicalSpace(request);
  if (!spaceId) return forbidden();
  const { profile } = await readDb(spaceId);
  return noStore(Response.json({ pixKey: profile.pixKey || "" }));
}

export async function PUT(request: Request) {
  const spaceId = await clinicalSpace(request);
  if (!spaceId) return forbidden();
  try {
    const body = requireObject(await request.json());
    if (typeof body.pixKey !== "string" || !body.pixKey.trim() || body.pixKey.trim().length > 160) throw new Error("Informe uma chave Pix válida.");
    const pixKey = body.pixKey.trim();
    await updateDb(spaceId, db => { db.profile.pixKey = pixKey; });
    return noStore(Response.json({ pixKey }));
  } catch (error) { return errorResponse(error); }
}
