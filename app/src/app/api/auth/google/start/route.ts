import { codeChallenge, googleConfig, oauthCookie, randomOAuthValue } from "../../../../../lib/google-auth";
import { noStore } from "../../../../../lib/platform";

export const runtime = "nodejs";
export function GET(request: Request) {
  const config = googleConfig();
  if (!config) return noStore(new Response(null, { status: 302, headers: { Location: new URL("/login?erro=google_indisponivel", request.url).toString() } }));
  const secure = new URL(request.url).protocol === "https:";
  const state = randomOAuthValue(), nonce = randomOAuthValue(), verifier = randomOAuthValue();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code", scope: "openid email", state, nonce, code_challenge: codeChallenge(verifier), code_challenge_method: "S256" }).toString();
  const headers = new Headers({ Location: url.toString() });
  headers.append("Set-Cookie", oauthCookie("fisioapp_google_state", state, secure));
  headers.append("Set-Cookie", oauthCookie("fisioapp_google_nonce", nonce, secure));
  headers.append("Set-Cookie", oauthCookie("fisioapp_google_verifier", verifier, secure));
  return noStore(new Response(null, { status: 302, headers }));
}
