import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuth = pathname.startsWith("/login");
  const isApi = pathname.startsWith("/api");
  const isPublic =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/sw.js") ||
    pathname.startsWith("/manifest.json") ||
    pathname.startsWith("/offline.html") ||
    pathname === "/favicon.ico";

  if (isPublic || isApi) return NextResponse.next();

  const token = request.cookies.get("next-auth.session-token")?.value;

  if (!token && !isAuth) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (token && isAuth) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|sw.js|manifest.json|offline.html).*)"],
};
