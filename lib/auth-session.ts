// Simple single-user login gate. Credentials + session-cookie signing live here.
// Uses Web Crypto (HMAC-SHA256) so it runs in BOTH the Edge middleware and Node route handlers.
// The password is checked server-side only — it never ships to the client bundle.
//
// Configure via env (recommended in production):
//   AUTH_EMAIL, AUTH_PASSWORD, AUTH_SECRET
// Defaults below let it work out-of-the-box for the demo. Set AUTH_SECRET in Vercel so the
// session cookie can't be forged from the (public) default.

export const COOKIE_NAME = "tiq_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function creds() {
  return {
    email: (process.env.AUTH_EMAIL || "arunkodi@gmail.com").trim().toLowerCase(),
    password: process.env.AUTH_PASSWORD || "NivaBupa@123",
    secret: process.env.AUTH_SECRET || "tiq-demo-secret-please-set-AUTH_SECRET-4f9a2c7e",
  };
}

const encoder = new TextEncoder();

async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Validate a submitted email + password against the configured credentials. */
export function checkCredentials(email: string, password: string): boolean {
  const c = creds();
  return email.trim().toLowerCase() === c.email && password === c.password;
}

/** Deterministic signed token for the (single) authorized user. */
export async function makeSessionToken(): Promise<string> {
  const c = creds();
  return hmacHex(`authorized:${c.email}`, c.secret);
}

/** True when the cookie value matches a freshly-computed valid token. */
export async function isValidSession(token?: string | null): Promise<boolean> {
  if (!token) return false;
  const expected = await makeSessionToken();
  return token.length === expected.length && token === expected;
}
