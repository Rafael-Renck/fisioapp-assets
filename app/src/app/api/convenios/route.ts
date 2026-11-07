import { clinicalSpace, forbidden, noStore } from "../../../lib/platform";
import { errorResponse, readDb, requireObject, updateDb } from "../../../lib/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const spaceId = await clinicalSpace(request);
  if (!spaceId) return forbidden();
  const { insurances } = await readDb(spaceId);
  return noStore(Response.json({ insurances }));
}

export async function POST(request: Request) {
  const spaceId = await clinicalSpace(request);
  if (!spaceId) return forbidden();
  try {
    const { name: rawName } = requireObject(await request.json());
    const name = typeof rawName === "string" ? rawName.trim() : "";
    if (!name || name.length > 120) throw new Error("Informe o nome do convênio.");
    const insurances = await updateDb(spaceId, db => {
      if (!db.insurances.some(item => item.localeCompare(name, "pt-BR", { sensitivity: "accent" }) === 0)) db.insurances.push(name);
      return db.insurances;
    });
    return noStore(Response.json({ insurances }));
  } catch (error) { return errorResponse(error); }
}
