import { clinicalSpace, forbidden, noStore } from "../../../../lib/platform";
import { errorResponse, readDb, requireObject, updateDb } from "../../../../lib/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const spaceId = await clinicalSpace(request);
  if (!spaceId) return forbidden();
  const { profile } = await readDb(spaceId);
  return noStore(Response.json({ signatureImage: profile.signatureImage || "" }));
}

export async function PUT(request: Request) {
  const spaceId = await clinicalSpace(request);
  if (!spaceId) return forbidden();
  try {
    const body = requireObject(await request.json());
    const signatureImage = body.signatureImage;
    if (typeof signatureImage !== "string") throw new Error("Imagem da assinatura inválida.");
    if (signatureImage) {
      const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(signatureImage);
      if (!match || signatureImage.length > 1_400_000) throw new Error("Use uma imagem PNG, JPG ou WebP de até 1 MB.");
      const bytes = Buffer.from(match[2], "base64");
      const png = match[1] === "png" && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const jpeg = match[1] === "jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8;
      const webp = match[1] === "webp" && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
      if (bytes.length > 1_000_000 || !(png || jpeg || webp)) throw new Error("Arquivo de imagem inválido ou maior que 1 MB.");
    }
    await updateDb(spaceId, db => { db.profile.signatureImage = signatureImage; });
    return noStore(Response.json({ signatureImage }));
  } catch (error) { return errorResponse(error); }
}
