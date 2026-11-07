import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

export const googleCookiePath = "/api/auth/google";
export const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) return null;
  const url = new URL(redirectUri);
  if (url.pathname !== `${googleCookiePath}/callback` || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) throw new Error("GOOGLE_REDIRECT_URI inválida.");
  return { clientId, clientSecret, redirectUri };
}

export function randomOAuthValue() { return randomBytes(32).toString("base64url"); }
export function codeChallenge(verifier: string) { return createHash("sha256").update(verifier).digest("base64url"); }
export function equalOAuthValue(a: string | undefined, b: string | null) {
  if (!a || !b) return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function oauthCookie(name: string, value: string, secure: boolean, clear = false) {
  return `${name}=${value}; Path=${googleCookiePath}; HttpOnly; SameSite=Lax; ${secure ? "Secure; " : ""}Max-Age=${clear ? 0 : 600}`;
}
export function oauthCookies(request: Request) {
  return Object.fromEntries((request.headers.get("cookie") || "").split(";").map(part => part.trim().split("=")).filter(parts => parts.length === 2));
}
export function clearOAuthCookies(headers: Headers, secure: boolean) {
  for (const name of ["fisioapp_google_state", "fisioapp_google_nonce", "fisioapp_google_verifier"]) headers.append("Set-Cookie", oauthCookie(name, "", secure, true));
}
export async function verifyGoogleIdToken(token: string, clientId: string, nonce: string) {
  const { payload } = await jwtVerify(token, googleJwks, { audience: clientId, issuer: ["https://accounts.google.com", "accounts.google.com"], algorithms: ["RS256"] });
  if (payload.nonce !== nonce || payload.email_verified !== true || typeof payload.email !== "string" || !payload.sub) throw new Error("Identidade do Google inválida.");
  return { email: payload.email, subject: payload.sub };
}
