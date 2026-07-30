# Deploying Territory IQ (free tier)

This guide hosts the app **for free** using:

- **Vercel** (Hobby) — runs the Next.js app, auto-deploys from GitHub
- **Neon** — free serverless Postgres (the schema already supports its pooled + direct URLs)
- **LLM** — your own Anthropic/Gemini/Groq key, set in-app; poster backgrounds work free via Pollinations

> ⚠️ **Before real client data:** the app uses a spoofable header-based identity (`DEFAULT_TENANT_ID`), not real login. Fine for a demo/POC on a private URL. Wire Supabase Auth + RLS before production. Also: Vercel's Hobby plan is **non-commercial** — use a paid plan or a commercial-friendly host for a live client product.

---

## Prerequisites
- The repo is on GitHub: `digitalvetri/niva-bupa` ✅
- A free **Neon** account → https://neon.tech
- A free **Vercel** account → https://vercel.com (sign in with GitHub)
- Node 18+ locally (only needed once, to run the DB migration)

---

## Step 1 — Create the database (Neon)
1. Go to https://neon.tech → **New Project** → name it `niva-bupa` → pick a region close to your users → **Create**.
2. On the project dashboard, open **Connection Details**.
3. Copy **two** connection strings (toggle "Pooled connection" to get each):
   - **Pooled** — host contains `-pooler` → this is your `DATABASE_URL`
   - **Direct** — host has no `-pooler` → this is your `DIRECT_URL`
4. Make sure each string ends with `?sslmode=require` (Neon includes it by default).

Example:
```
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
```

## Step 2 — Create the tables (run migrations once)
Run this from your local machine, pointing at Neon:

```bash
DATABASE_URL="<pooled url>" DIRECT_URL="<direct url>" npm run db:deploy
```

This applies the committed Prisma migrations (`prisma migrate deploy`) to the Neon database.

## Step 3 — (Optional) Seed demo data
Loads an anonymized demo tenant so the dashboard isn't empty on first open:

```bash
DATABASE_URL="<pooled url>" DIRECT_URL="<direct url>" npm run seed:demo
```

You can skip this and just upload a CSV from the **Uploads** page after deploy.

## Step 4 — Deploy on Vercel
1. Go to https://vercel.com → **Add New… → Project** → **Import** `digitalvetri/niva-bupa`.
2. Framework preset: **Next.js** (auto-detected). Leave build/output defaults — the repo's build script already runs `prisma generate && next build`.
3. Open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Neon **pooled** URL (from Step 1) |
   | `DIRECT_URL` | Neon **direct** URL (from Step 1) |
   | `DEFAULT_TENANT_ID` | `00000000-0000-0000-0000-000000000001` |
   | `ANTHROPIC_API_KEY` | *(optional)* fallback bot key if not set in-app |
   | `N8N_NUDGE_WEBHOOK` | *(optional)* WhatsApp nudge webhook |

   > If you seeded a different tenant id in Step 3, use that value for `DEFAULT_TENANT_ID`.
4. Click **Deploy**. First build takes ~1–2 min.

## Step 5 — After it's live
1. Open the Vercel URL (e.g. `https://niva-bupa.vercel.app`).
2. Go to **Settings** →
   - **AI provider**: paste an Anthropic/Gemini/Groq key to enable the "Ask Territory IQ" bot.
   - **Report background image**: choose **Pollinations** (free, no key) to enable AI poster backgrounds.
3. Go to **Uploads** → drop a New Business CSV → the dashboard and posters populate.

Every `git push` to `main` now auto-deploys to Vercel.

---

## Environment variable reference
| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | Pooled Postgres connection (serverless-safe) |
| `DIRECT_URL` | ✅ | Direct connection for migrations |
| `DEFAULT_TENANT_ID` | ✅ | Tenant used when no auth header is present |
| `ANTHROPIC_API_KEY` | — | Bot fallback key (can be set per-tenant in Settings instead) |
| `ANTHROPIC_MODEL` | — | Override bot model |
| `N8N_NUDGE_WEBHOOK` | — | WhatsApp nudge delivery |
| `SENTRY_DSN` | — | Error reporting |

---

## Alternative: Supabase all-in-one (also free)
If you'd rather use one service (and plan to add real login later):
1. Create a project at https://supabase.com.
2. **Project Settings → Database → Connection string**: use the **Transaction pooler** (port `6543`, add `?pgbouncer=true`) as `DATABASE_URL`, and the **direct** string (port `5432`) as `DIRECT_URL`.
3. Do Steps 2–5 above the same way. Supabase also gives you Auth + Storage for when you wire real authentication.

Other free options: **Render** (free web service, sleeps when idle), **Netlify**, **Cloudflare Pages** (needs the `@cloudflare/next-on-pages` adapter).
