# Territory IQ — Phase 5 Hardening Report

_Status: 186 tests passing + 40 skipped (live LLM suite), `tsc --noEmit` clean. Verified against the real 81-line Niva Bupa fixture and an anonymized demo tenant._

This is the written report PROMPT 5 asks for: what's tested, what isn't, known limitations, and the three riskiest things about running this in production.

---

## 1. What IS tested

**Tenant isolation & branch scoping — through the API (`tests/rls.test.ts`, 10 tests).**
The real Next route handlers (`/api/metrics/:name`, `/api/cases`, `/api/cases/export`, `/api/reports/:id/issues`, `/api/reports`) are invoked with two distinct simulated identities:
- Tenant A reading tenant B's snapshot id → **404** on every read route (the API never confirms another tenant's snapshot exists).
- `snapshot_compare` requires **both** snapshots to be owned by the caller.
- `/api/reports` lists only the caller's snapshots.
- A branch-scoped user (`branchScope=[Salem]`) sees **only** Salem; passing `branch=[Erode]` yields **zero rows** (an empty scope-intersection denies — it does not fall through to "all branches"). This empty-intersection leak was caught by the test and fixed.

**§11 PII discipline (`tests/pii.test.ts`, 2 tests).** After a multi-turn conversation whose prior answer named real stuck cases, the router now receives **sanitized** history — assistant narration is stripped, so no customer name reaches the intent-classification call, while the user's own questions (topic + follow-up) are preserved. Row-level answers (`stuck_cases`) return only the rows the filter needs (Salem → 10, not all 30).

**Rate limiting, observability, failure paths (`tests/hardening.test.ts`, 5 tests).** Fixed-window limiter (allow→block→reset); observability counter accumulation; upload failure paths through the real handler — non-`.csv` → **415**, unrecognized format → **422**, missing file → **400**, each with a human-readable message.

**Anonymization (`tests/anonymize.test.ts`, 2 tests + live).** `anonymizeCsv` strips every real customer/agent/AM name while preserving referential integrity, so aggregates are **byte-identical** (logged ₹31,77,434; Salem 21/₹8,57,759; top agent 6 cases/₹2,97,314 — now "Agent 005"). Verified end-to-end by seeding a demo tenant.

**Everything from Phases 1–4** still green (ingestion, 17-metric engine, compare math, nudge draft/cap/phone, dashboard). Full suite: **186 passing**.

---

## 2. What is NOT tested (honest gaps)

- **Bot §14 live accuracy (40 questions) — never executed.** No Anthropic credentials in this environment. The ground-truth *harness* runs credential-free (38 resolvers pinned against the DB), but the live router+narrator path — the actual Phase-3 DoD — has not run. Set `ANTHROPIC_API_KEY` and re-run `tests/bot.accuracy.test.ts`.
- **WhatsApp (WABA) delivery — verified only to the boundary.** No `N8N_NUDGE_WEBHOOK`. The queue → `NudgeLog` → copy-to-clipboard fallback → per-user cap are all verified; the actual message to a sandbox WABA number is not.
- **`/api/settings` and `/api/nudge` are not in the RLS suite.** They key off the same tenant context as the tested routes, so they inherit the same isolation *and the same identity weakness* (below). No cross-tenant read endpoint exists for chat/nudge logs, so those are safe by absence — but settings-route isolation is asserted by design, not exercised by a test.
- **Load / performance** (5,000-row ingest ≤ 8 s target), **multi-instance behavior**, and **real Sentry delivery** are not tested.

---

## 3. Known limitations

1. **Identity is a development header shim, not authentication.** `contextFromRequest` reads `x-tenant-id` / `x-role` / `x-branch-scope` from client-controlled headers (falling back to `DEFAULT_TENANT_ID`). The RLS tests prove the **enforcement logic** is correct *given a trusted identity* — but the identity itself is spoofable today. **Real Supabase JWT auth (§10) is a prerequisite for any production security claim.**
2. **App-level enforcement, not Postgres RLS.** Prisma connects with a service role that bypasses DB-level policies, so isolation lives entirely in `lib/access.ts`. A future route that forgets `requireSnapshot` would leak with no second line of defense. The spec's intended model is Postgres RLS as defense-in-depth *behind* the app checks.
3. **In-memory rate limiter** — per-process; a multi-instance deploy must swap it for Redis/Upstash (interface unchanged).
4. **Observability is a structured-log shim**, Sentry-pluggable via `SENTRY_DSN` but not wired to a real transport.
5. **Synchronous ingestion** — the upload runs the full parse+insert inside the request; large files risk request timeouts (needs a background job).
6. **High-value threshold** is honored by the `high_value_stuck` route but not (yet) by the Pulse attention banner.

---

## 4. The three riskiest things about running this in production

### 🔴 1. There is no authentication — the tenant boundary is spoofable
Every isolation guarantee depends on a trusted `x-tenant-id`. Today anyone can send another tenant's UUID and read their snapshots, cases, and phone mappings. **The isolation *code* is correct and tested; the *identity* is not yet real.** Fix before onboarding any real customer: Supabase Auth issues a JWT with a `tenant_id` claim (§10 hook), drop the header/`DEFAULT_TENANT_ID` fallback, and add Postgres RLS policies keyed on `auth.jwt() ->> 'tenant_id'` as defense-in-depth behind the app checks. This is the single blocking item for production.

### 🔴 2. LLM correctness and cost are unproven at scale
The §14 accuracy suite has never run live, so real routing/narration accuracy is unmeasured; the numeric-drift guard is a *post-hoc* check (it flags drift after the fact, it doesn't prevent a mis-routed metric); and there is no per-tenant cost ceiling beyond 30 requests/min. A mis-routed question returns the *wrong metric's correct number* — which looks authoritative. Run the 40-question suite against production prompts, add cost caps, and consider a confirmation UI for high-stakes answers.

### 🔴 3. Single-instance, synchronous assumptions
The rate limiter is in-memory, ingestion is synchronous in the request path (5,000-row files may time out), and nudges POST to the webhook inline with no retry queue. The moment this runs on more than one instance — or ingests a large file — these break. Move ingestion and nudge delivery to background jobs, and rate limiting to a shared store, before real load.

---

_Prepared for DigitalVetri.AI. When in doubt: deterministic metrics, loud failures, Indian number formatting — and no production data until auth is real._
