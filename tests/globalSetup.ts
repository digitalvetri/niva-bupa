// Runs once per test run: truncate the test DB so the fixture is re-ingested with current code
// (otherwise dedup-by-hash would reuse a stale snapshot and mask parser changes).
import { config } from "dotenv";
config();
// Never truncate the dev DB — pin to the dedicated test DB.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
import { PrismaClient } from "@prisma/client";

export default async function () {
  const prisma = new PrismaClient();
  await prisma.$executeRawUnsafe(
    `TRUNCATE "NbCase","IngestionIssue","ReportSnapshot","ChatMessage","NudgeLog","User","Tenant" RESTART IDENTITY CASCADE;`,
  );
  await prisma.$disconnect();
}
