import { NextResponse, type NextRequest } from "next/server";
import { canAccessClinical, getSession, isManager } from "./lib/platform";
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path.startsWith("/convite/")) return NextResponse.next();
  const session = await getSession(request);
  if (!session) {
    if (path === "/login" || path === "/setup" || path.startsWith("/convite/")) return NextResponse.next();
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (session.user.role === "patient") {
    if (path === "/login" || path === "/setup" || path.startsWith("/convite/")) return NextResponse.redirect(new URL("/minhas-contracoes", request.url));
    return path === "/minhas-contracoes" ? NextResponse.next() : NextResponse.redirect(new URL("/minhas-contracoes", request.url));
  }
  if (path === "/configuracoes/usuarios" && (!isManager(session.user.role) || session.user.mustChangePassword)) return NextResponse.redirect(new URL("/configuracoes", request.url));
  if (!canAccessClinical(session.user.role) && (path.startsWith("/doulagem") || path.startsWith("/prontuarios") || path.startsWith("/pacientes/") || path === "/relatorios")) return NextResponse.redirect(new URL("/agenda", request.url));
  if (path === "/minhas-contracoes") return NextResponse.redirect(new URL("/doulagem/contracoes", request.url));
  if (path === "/login" || path === "/setup" || path.startsWith("/convite/")) return NextResponse.redirect(new URL(session.user.mustChangePassword ? "/configuracoes" : "/", request.url));
  if (path === "/admin") return NextResponse.redirect(new URL(session.user.role === "owner" ? "/configuracoes" : "/", request.url));
  if (session.user.mustChangePassword && path !== "/configuracoes") return NextResponse.redirect(new URL("/configuracoes", request.url));
  return NextResponse.next();
}
export const config = { matcher: ["/", "/agenda/:path*", "/doulagem/:path*", "/doulagem", "/minhas-contracoes", "/convite/:path*", "/pacientes/:path*", "/prontuarios/:path*", "/relatorios/:path*", "/configuracoes/:path*", "/admin/:path*", "/login", "/setup"] };
