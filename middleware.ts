// Auth gate: everything except /login and /api/login requires a valid session cookie.
// Unauthenticated page requests redirect to /login; unauthenticated API requests get 401.
import { NextResponse, type NextRequest } from "next/server";
import { isValidSession, COOKIE_NAME } from "@/lib/auth-session";

const PUBLIC_PATHS = ["/login", "/api/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authed = await isValidSession(req.cookies.get(COOKIE_NAME)?.value);
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isPublic) {
    // Already signed in and visiting /login → send to the dashboard.
    if (authed && pathname === "/login") return NextResponse.redirect(new URL("/pulse", req.url));
    return NextResponse.next();
  }

  if (!authed) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = new URL("/login", req.url);
    if (pathname && pathname !== "/") url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static image assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
