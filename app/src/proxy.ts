import { NextResponse, type NextRequest } from "next/server";
import { getSession, readPlatform } from "./lib/platform";
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const session = await getSession(request);
  if (!session) {
    if (path === "/login" || path === "/setup") return NextResponse.next();
    const installed = (await readPlatform()).users.some(user => user.role === "owner");
    return NextResponse.redirect(new URL(installed ? "/login" : "/setup", request.url));
  }
  if (path === "/login" || path === "/setup") return NextResponse.redirect(new URL(session.user.role === "owner" ? "/admin" : "/", request.url));
  if (session.user.role === "owner" && path !== "/admin") return NextResponse.redirect(new URL("/admin", request.url));
  if (session.user.role === "physio" && path === "/admin") return NextResponse.redirect(new URL("/", request.url));
  if (session.user.mustChangePassword && path !== "/configuracoes") return NextResponse.redirect(new URL("/configuracoes", request.url));
  return NextResponse.next();
}
export const config = { matcher: ["/", "/agenda/:path*", "/pacientes/:path*", "/configuracoes/:path*", "/admin/:path*", "/login", "/setup"] };
