// POST /api/login — validate credentials server-side, set an httpOnly signed session cookie.
import { NextResponse, type NextRequest } from "next/server";
import { checkCredentials, makeSessionToken, COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/auth-session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!checkCredentials(body.email ?? "", body.password ?? "")) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, await makeSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
