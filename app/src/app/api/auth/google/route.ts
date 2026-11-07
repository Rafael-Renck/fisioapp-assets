import { googleConfig } from "../../../../lib/google-auth";
import { noStore } from "../../../../lib/platform";

export const runtime = "nodejs";
export function GET() {
  try { return noStore(Response.json({ available: !!googleConfig() })); }
  catch { return noStore(Response.json({ available: false })); }
}
