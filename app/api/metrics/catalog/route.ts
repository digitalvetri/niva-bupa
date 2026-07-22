// GET /api/metrics/catalog — machine-readable catalog the Phase 3 bot reads (§5).
import { NextResponse } from "next/server";
import { catalogManifest } from "@/lib/metrics/catalog";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ metrics: catalogManifest() });
}
