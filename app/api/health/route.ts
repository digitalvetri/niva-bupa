// Temporary deploy-diagnostic endpoint. Reports whether DB env vars reached the serverless
// function and whether Prisma can reach Neon — WITHOUT exposing any credentials. Safe to delete
// once the deployment is healthy.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hostOnly(url?: string): string | null {
  if (!url) return null;
  const at = url.split("@")[1] ?? "";
  return at.split("/")[0] || null; // host:port only, never user:pass
}
function redact(msg: string): string {
  return msg.replace(/postgres(ql)?:\/\/[^@\s]+@/gi, "postgresql://***@");
}

export async function GET() {
  const env = {
    DATABASE_URL_present: Boolean(process.env.DATABASE_URL),
    DIRECT_URL_present: Boolean(process.env.DIRECT_URL),
    DEFAULT_TENANT_ID: process.env.DEFAULT_TENANT_ID ?? null,
    db_host: hostOnly(process.env.DATABASE_URL),
  };
  try {
    await prisma.$queryRaw`SELECT 1`;
    const snapshots = await prisma.reportSnapshot.count();
    return NextResponse.json({ ok: true, env, snapshots });
  } catch (e) {
    return NextResponse.json({ ok: false, env, error: redact((e as Error).message) });
  }
}
