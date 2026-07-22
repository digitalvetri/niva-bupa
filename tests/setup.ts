// Load .env for the Prisma client (@prisma/client does not auto-load .env; only the CLI does).
import { config } from "dotenv";
config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL not set — see .env (local Postgres test DB).");
}
