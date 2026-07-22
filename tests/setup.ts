// Load .env for the Prisma client (@prisma/client does not auto-load .env; only the CLI does).
import { config } from "dotenv";
config();

// Tests TRUNCATE — force them onto the dedicated test DB so they never wipe the dev DB.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL not set — see .env (local Postgres test DB).");
}
