import { clearOAuthCookies, equalOAuthValue, googleConfig, oauthCookies, verifyGoogleIdToken } from "../../../../../lib/google-auth";
import { createSession, normalizeEmail, noStore, updatePlatform } from "../../../../../lib/platform";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secure = url.protocol === "https:";
  const headers = new Headers();
  clearOAuthCookies(headers, secure);
  const redirect = (error: string) => noStore(new Response(null, { status: 302, headers: new Headers([...headers, ["Location", new URL(`/login?erro=${error}`, url).toString()]]) }));
  try {
    const config = googleConfig();
    if (!config) return redirect("google_indisponivel");
    const cookies = oauthCookies(request);
    if (!equalOAuthValue(cookies.fisioapp_google_state, url.searchParams.get("state")) || !cookies.fisioapp_google_nonce || !cookies.fisioapp_google_verifier || !url.searchParams.get("code")) return redirect("google_falhou");
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code: url.searchParams.get("code")!, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: "authorization_code", code_verifier: cookies.fisioapp_google_verifier }), cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!tokenResponse.ok) return redirect("google_falhou");
    const tokens = await tokenResponse.json() as { id_token?: string };
    if (!tokens.id_token) return redirect("google_falhou");
    const identity = await verifyGoogleIdToken(tokens.id_token, config.clientId, cookies.fisioapp_google_nonce);
    const user = await updatePlatform(platform => {
      const account = platform.users.find(item => item.googleSub === identity.subject) || platform.users.find(item => item.email === normalizeEmail(identity.email));
      if (!account || account.role === "patient" || account.active === false || account.mustChangePassword || account.googleSub && account.googleSub !== identity.subject || platform.users.some(item => item !== account && item.googleSub === identity.subject)) return null;
      const space = platform.spaces.find(item => item.id === account.spaceId);
      if (account.role !== "owner" && (!space || space.status !== "active")) return null;
      account.googleSub = identity.subject;
      return { id: account.id, role: account.role };
    });
    if (!user) return redirect("google_sem_acesso");
    headers.append("Set-Cookie", await createSession(user.id, request));
    headers.set("Location", new URL("/", url).toString());
    return noStore(new Response(null, { status: 302, headers }));
  } catch { return redirect("google_falhou"); }
}
