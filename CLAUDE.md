# TERRITORY IQ — Master Build Spec (CLAUDE.md)

**Product:** AI-powered New Business Command Center for Insurance Territory Heads
**Client vertical:** Health insurance (built on Niva Bupa NB Report format; designed insurer-agnostic)
**Builder:** DigitalVetri.AI
**Version:** 1.0 — 22 Jul 2026
**Stack:** Next.js 14 (App Router) · Supabase (Postgres + Auth + Storage + RLS) · Prisma · Tailwind + shadcn/ui · Recharts · Claude API (router/narrator) · Groq (intent classification, optional) · n8n + WhatsApp Cloud API (actions)

---

## 0. HOW TO USE THIS FILE

This is the single source of truth for Claude Code. Build strictly in the phase order of §12.
Golden rules:

1. **The LLM never does math.** Every number shown anywhere (dashboard or bot) comes from the Metric Engine (§6). The bot routes to metrics; it does not compute.
2. **One ingestion path.** Dashboard and bot read from the same normalized tables. No parallel parsing.
3. **Every upload is a snapshot.** Never overwrite. Snapshots enable week-over-week comparison (killer feature).
4. **Fail loudly on ingestion, never silently drop rows.** Unparseable rows go to `ingestion_issues`, surfaced in UI.
5. **Tanglish-friendly bot.** Users ask in English, Tamil, or Tanglish. Answers in the user's language, numbers in Indian format (₹31.77L, not ₹3,177,434 — provide both on hover).

---

## 1. PRODUCT OVERVIEW

### 1.1 Problem
A Territory Head (TH) of a health insurer's Tamil Nadu region receives a ~96-column New Business (NB) CSV export. Today he scrolls Excel to answer: Which branch is behind? How much premium is stuck in underwriting? Which agent needs a call? This takes hours and misses cases.

### 1.2 Solution
Upload the CSV → auto-segmented dashboard in <10 seconds + a chat bot that answers any question about the data with verified numbers + one-tap WhatsApp nudges for stuck cases.

### 1.3 Personas
| Persona | Access | Primary job-to-be-done |
|---|---|---|
| Territory Head (primary) | All branches | "Where is premium leaking, who do I call today?" |
| Branch Manager (later) | Own branch (RLS) | Track own funnel + agents |
| Agency Manager (later) | Own agents (RLS) | Case-level follow-up |

### 1.4 Success criteria (v1)
- Upload → dashboard fully rendered ≤ 10 s for 5,000-row file.
- Bot answers the 40-question test set (§14) with 100% numeric accuracy (deterministic metrics).
- TH can produce his Monday review meeting numbers without opening Excel.

---

## 2. INPUT FILE — DATA DICTIONARY

Source: `rpts_NewBusinessReport_*.csv` (Niva Bupa export). ~96 columns, UTF-8 **with BOM**, CRLF line endings, may contain a trailing blank row.

### 2.1 Column groups (map raw → canonical)

**Identity / Customer**
| Raw column | Canonical | Type | Notes |
|---|---|---|---|
| Full Name | customer_name | text | Collapse double spaces; trim trailing " ." |
| Application Number | application_no | text | Primary business key within snapshot |
| Policy Number | policy_no | text? | Empty until issued |
| Customer ID | customer_id | text | |
| Customer City / Customer State | customer_city, customer_state | text | Title-case; state uppercase variants exist ("TAMIL NADU"/"Tamil Nadu") |

**Product**
| Raw | Canonical | Notes |
|---|---|---|
| Plan Type | plan_type | Normalize case: "Family Floater"/"Family floater" → `FAMILY_FLOATER`; "Individual" → `INDIVIDUAL` |
| Product Genre | product_genre | e.g. REASSURE_3.0_BLACK, REASSURE_3.0_ELITE, Aspire, Reassure 2.0, Personal Accident Plan, Health Assurance V2, Health Recharge V2. May be blank → `UNKNOWN` |
| Plan Name | plan_name | Free text variant string |
| Insured Lives | insured_lives | int |
| Sum Assured | sum_assured_raw + sum_assured_numeric | "Unlimited" → numeric NULL + flag `is_unlimited_si=true`. "0", numbers otherwise |
| TENURE | tenure_years | "1","3","5" or "Annual","3 Yearly","5 Yearly" → int (1/3/5) |
| Payment term | payment_term | text |

**Money (all INR, integers in source)**
| Raw | Canonical | Notes |
|---|---|---|
| Logged Premium | logged_premium | numeric; blank → 0 |
| Issued Premium | issued_premium | numeric; blank/0 until issued |
| Loading Premium | loading_premium | numeric; >0 is a counter-offer/loading signal |

**Distribution hierarchy**
| Raw | Canonical | Notes |
|---|---|---|
| Login Branch | login_branch | **Primary geo dimension.** Normalize case: "ERODE"→"Erode". Observed: Chennai, Coimbatore, Erode, Salem, Hosur, Tirunelveli, Thanjavur, Trichy |
| Sales Branch | sales_branch | Often blank; do not use as primary dim |
| Channel / Sub Channel | channel | "AGENCY"/"Agency" → `AGENCY` |
| Agent Code / Agent Name | agent_code, agent_name | Name may be ".NONE." → treat as `UNASSIGNED` |
| Agency Manager ID / Name | am_id, am_name | Mid-hierarchy node |
| Designation | designation | |

**Funnel / status**
| Raw | Canonical | Notes |
|---|---|---|
| Sales Status | sales_status | **Primary funnel dimension.** See §2.2 |
| Lead Status | lead_status | Granular stage (Tele_UW_Required, Underwriting, Portability Maker, Reqmnt Triggered, Cheque Entry Branch OTC, …). Inconsistent casing/underscores — store raw + normalized |
| Maximus Status | maximus_status | Secondary system status |
| Current Status | current_status | "Active" when issued |
| Discrepancy Status | discrepancy_status | Non-empty = flag |
| Current Status Ageing | status_ageing_days | Int for pending cases; "N/A" for issued → NULL |
| Login Ageing | login_ageing_days | Same handling |

**Dates** — format `M/D/YYYY` (US style!). Parse explicitly, never locale-guess.
Logged Date → logged_date · Issued Date → issued_date · Conversion Date → conversion_date · Policy Start/End Date → policy_start, policy_end · DOB fields usually "N/A" → NULL.

**Flags**
| Raw | Canonical |
|---|---|
| Is Portability | is_portability (Yes/No → bool) |
| Is Split / Is Upsell | bools |
| Safe Guard, Co-Payment, riders block (~35 cols: Future Ready, Fast Forward, Borderless*, Cash-Bag, ElderOne, NivaBupaOne, HeadsUp, …) | Store as JSONB `riders` — do NOT create 35 columns. Values: Y/Yes/true; N/No/NO/false; NA/N/A/blank → null |

### 2.2 Sales Status → Funnel Stage mapping (canonical enum `FunnelStage`)
| sales_status (raw) | FunnelStage | Bucket |
|---|---|---|
| Policy issued | ISSUED | Won |
| Under processing with underwriting | UNDERWRITING | Pending |
| Under Processing with operations | OPERATIONS | Pending |
| Tele underwriting required | TELE_UW_REQUIRED | Pending — needs action |
| Additional Requirement raised / Additional Requirement Raised | REQUIREMENT_RAISED | Pending — needs action |
| Counter Offer Proposed / Counter Offer triggered | COUNTER_OFFER | Pending — needs decision |
| Counter Offer Loading | COUNTER_OFFER | Pending — needs decision |
| (blank) with no policy_no | UNKNOWN | Review |

`stuck_case` definition (used everywhere): `funnel_stage != ISSUED AND logged_premium > 0`.
`high_value_stuck`: stuck AND logged_premium ≥ 50,000 (configurable per tenant, `settings.high_value_threshold`).

### 2.3 Normalization rules (apply in this order)
1. Strip BOM; trim all cells; collapse internal double spaces in names.
2. `"N/A" | "NA" | "" | "-"` → NULL (except riders JSONB where mapped to null).
3. Casing: branches Title Case; states UPPER; enum columns via mapping tables above. Unknown enum value → store raw, map to `OTHER`, log to `ingestion_issues` (severity=warn).
4. Money: strip commas; non-numeric → 0 + warn.
5. Dates: `M/D/YYYY` parser; failures → NULL + warn.
6. Row with no application_no AND no customer_name → skip + record (severity=info, "blank row").
7. Duplicate application_no within one file → keep last, warn.

---

## 3. DATABASE SCHEMA (Prisma)

```prisma
// schema.prisma — core models. Multi-tenant from day 1.

model Tenant {
  id        String   @id @default(uuid())
  name      String
  settings  Json     @default("{}") // { high_value_threshold: 50000, currency: "INR" }
  users     User[]
  snapshots ReportSnapshot[]
  createdAt DateTime @default(now())
}

model User {
  id        String  @id @default(uuid()) // = Supabase auth.uid
  tenantId  String
  tenant    Tenant  @relation(fields: [tenantId], references: [id])
  role      Role    @default(TERRITORY_HEAD)
  branchScope String[] @default([]) // empty = all branches
  waPhone   String?  // for sending nudges via their WABA
}

enum Role { TERRITORY_HEAD BRANCH_MANAGER AGENCY_MANAGER VIEWER }

model ReportSnapshot {
  id           String   @id @default(uuid())
  tenantId     String
  tenant       Tenant   @relation(fields: [tenantId], references: [id])
  fileName     String
  fileHash     String   // sha256 — dedupe re-uploads
  reportType   String   @default("NB_REPORT")
  periodStart  DateTime? // min(logged_date)
  periodEnd    DateTime? // max(logged_date)
  rowCount     Int
  status       SnapshotStatus @default(PROCESSING)
  uploadedById String
  createdAt    DateTime @default(now())
  cases        NbCase[]
  issues       IngestionIssue[]
  @@unique([tenantId, fileHash])
  @@index([tenantId, createdAt])
}

enum SnapshotStatus { PROCESSING READY FAILED }

model NbCase {
  id              String   @id @default(uuid())
  snapshotId      String
  snapshot        ReportSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  tenantId        String   // denormalized for RLS
  applicationNo   String
  policyNo        String?
  customerId      String?
  customerName    String
  customerCity    String?
  customerState   String?
  planType        String?  // FAMILY_FLOATER | INDIVIDUAL | OTHER
  productGenre    String   @default("UNKNOWN")
  planName        String?
  insuredLives    Int?
  sumAssured      Decimal? @db.Decimal(14,2)
  isUnlimitedSi   Boolean  @default(false)
  loggedPremium   Decimal  @default(0) @db.Decimal(12,2)
  issuedPremium   Decimal  @default(0) @db.Decimal(12,2)
  loadingPremium  Decimal  @default(0) @db.Decimal(12,2)
  loginBranch     String
  channel         String?
  agentCode       String?
  agentName       String   @default("UNASSIGNED")
  amId            String?
  amName          String?
  salesStatusRaw  String?
  leadStatusRaw   String?
  funnelStage     String   // FunnelStage enum value
  discrepancy     Boolean  @default(false)
  statusAgeing    Int?
  loginAgeing     Int?
  isPortability   Boolean  @default(false)
  tenureYears     Int?
  loggedDate      DateTime?
  issuedDate      DateTime?
  policyStart     DateTime?
  policyEnd       DateTime?
  riders          Json     @default("{}")
  raw             Json     // full original row — audit + future columns
  @@index([snapshotId, loginBranch])
  @@index([snapshotId, funnelStage])
  @@index([snapshotId, agentName])
  @@index([tenantId, applicationNo])
}

model IngestionIssue {
  id         String @id @default(uuid())
  snapshotId String
  snapshot   ReportSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  rowNumber  Int?
  severity   String // info | warn | error
  message    String
  rawRow     Json?
}

model ChatMessage {
  id         String   @id @default(uuid())
  tenantId   String
  userId     String
  snapshotId String?
  role       String   // user | assistant
  content    String
  toolTrace  Json?    // { metric: "premium_by_branch", filters: {...}, resultHash }
  createdAt  DateTime @default(now())
  @@index([tenantId, userId, createdAt])
}

model NudgeLog {
  id         String   @id @default(uuid())
  tenantId   String
  caseId     String
  channel    String   @default("WHATSAPP")
  toName     String
  toPhone    String?
  message    String
  status     String   @default("QUEUED") // QUEUED | SENT | FAILED
  createdAt  DateTime @default(now())
}
```

**RLS (Supabase):** every table filtered by `tenantId = auth.jwt() ->> 'tenant_id'`; branch-scoped roles additionally filtered by `loginBranch = ANY(branch_scope)`. Write policies: only service role inserts cases/snapshots (ingestion runs server-side).

---

## 4. INGESTION PIPELINE

Route: `POST /api/reports/upload` (multipart). Server-side only (service role).

```
1. Receive file → store original in Supabase Storage: tenants/{tenantId}/raw/{uuid}.csv
2. sha256 → if (tenantId, hash) exists → return existing snapshot ("Already uploaded on {date}")
3. Create ReportSnapshot (PROCESSING)
4. Parse with papaparse (server) — encoding utf-8, skipEmptyLines: 'greedy'
5. Fingerprint: check ≥90% of expected NB header columns present.
   Miss → snapshot FAILED + issue "Unrecognized report format" (extension point for other report types later)
6. Per row: apply §2.3 normalization → map §2.1/§2.2 → build NbCase records
7. Bulk insert in batches of 500 (prisma createMany)
8. Compute periodStart/periodEnd/rowCount → snapshot READY
9. Return { snapshotId, rowCount, issueCount, durationMs }
```

Performance target: 5,000 rows ≤ 8 s. Files up to 20 MB. Streaming parse if >5 MB.

---

## 5. API SURFACE

All routes under `/api`, auth via Supabase session, tenant from JWT.

| Route | Method | Purpose |
|---|---|---|
| /reports/upload | POST | Ingest (§4) |
| /reports | GET | List snapshots (for snapshot switcher + comparison picker) |
| /reports/:id/issues | GET | Ingestion issues |
| /metrics/:name | GET | Run one metric. Query params: `snapshotId`, `filters` (JSON), `compareSnapshotId?` |
| /metrics/catalog | GET | Machine-readable metric catalog (§6) — this is what the bot reads |
| /chat | POST | Bot turn (§7). Body: { snapshotId, messages[] } → SSE stream |
| /nudge | POST | Queue WhatsApp nudge (§9) |
| /cases | GET | Filterable case table (server-side pagination, all §6 filter dims) |

---

## 6. METRIC ENGINE (the semantic layer — heart of the product)

One TypeScript module: `lib/metrics/`. Each metric = pure function `(db, snapshotId, filters) → MetricResult`. Registered in a catalog with metadata the bot consumes.

### 6.1 Shared filter object
```ts
type Filters = {
  branch?: string[]; agent?: string[]; am?: string[];
  productGenre?: string[]; planType?: string[];
  funnelStage?: string[]; bucket?: ("Won"|"Pending"|"Review")[];
  isPortability?: boolean; discrepancyOnly?: boolean;
  minLoggedPremium?: number; customerState?: string[];
  dateFrom?: string; dateTo?: string; // on loggedDate
}
```

### 6.2 Metric catalog (v1 — build all of these)
| id | Description | Output shape |
|---|---|---|
| totals | logged_premium, issued_premium, case_count, issued_count, conversion_pct, avg_ticket | scalar set |
| premium_by_branch | cases, logged, issued, conversion% per login_branch, ranked | table |
| premium_by_product | same per product_genre | table |
| premium_by_plan_type | family floater vs individual split | table |
| funnel | cases + logged premium per FunnelStage, ordered | table |
| stuck_summary | count + premium of stuck cases, grouped by lead_status_raw normalized | table |
| stuck_cases | row-level stuck case list, sorted by loggedPremium desc | rows |
| high_value_stuck | stuck_cases with threshold filter | rows |
| agent_leaderboard | per agent: cases, logged, issued, conversion%, stuck_count | table |
| am_leaderboard | same per agency manager | table |
| branch_agent_matrix | branch × agent premium pivot | matrix |
| portability_summary | portability vs fresh: count, premium, conversion% | table |
| ageing_buckets | pending cases by status_ageing: 0–3, 4–7, 8–14, 15+ days | table |
| ticket_size_distribution | histogram buckets: <10K, 10–25K, 25–50K, 50K–1L, 1L+ | table |
| tenure_mix | 1yr / 3yr / 5yr split | table |
| discrepancy_cases | rows where discrepancy flag | rows |
| geo_customer | cases + premium by customer_state / customer_city (note: differs from branch — out-of-state customers exist, e.g. Karnataka/Telangana rows) | table |
| daily_trend | logged & issued premium per loggedDate within snapshot | series |
| case_lookup | fetch single case by applicationNo or fuzzy customerName | row |
| snapshot_compare | any metric above diffed across two snapshots: value, prev, delta, delta_pct | table |

### 6.3 Formatting rules
- `formatINR(n)`: ≥1 Cr → "₹1.23Cr"; ≥1 L → "₹31.77L"; else "₹30,062" (Indian digit grouping).
- Percentages 1 decimal. Never round premiums before summing.
- Every MetricResult includes `meta: { rowsMatched, filtersApplied, snapshotId, computedAt }` — surfaced in UI as provenance.

---

## 7. AI BOT ("Ask Territory IQ")

### 7.1 Architecture — router, not calculator
```
User msg → [Intent Router LLM call]
  → tool schema = metric catalog (§6.2) exposed as tools, one tool per metric,
    params = Filters + metricId
  → Claude picks tool(s) + filters (multi-tool allowed, max 3 per turn)
→ Server executes metric functions (deterministic SQL)
→ [Narrator LLM call] gets: user question + tool results (JSON) + language hint
  → responds in user's language (English/Tamil/Tanglish), quoting ONLY numbers
    present in tool results, attaches chart spec
→ Client renders text + chart + provenance chip ("52 rows · Salem branch · this snapshot")
```

Model: Claude Sonnet (claude-sonnet-4-6) for both calls. Optional cost mode: Groq Llama for routing, Claude for narration. Stream narration via SSE.

### 7.2 Router system prompt (embed verbatim, adapt)
```
You answer questions about an insurance New Business report by calling metric tools.
Rules:
- ALWAYS call a tool. Never answer numbers from memory.
- Map colloquial terms: "pending/stuck/aakala" → bucket:["Pending"]; "issued/converted/mudinja" → funnelStage:["ISSUED"]; "port cases" → isPortability:true; "big cases" → minLoggedPremium:50000.
- Branch names may come in Tamil transliteration (e.g., "Selam"→Salem, "Kovai"→Coimbatore, "Nellai"→Tirunelveli, "Tanjore"→Thanjavur). Normalize.
- If question is comparative across uploads, use snapshot_compare.
- If question cannot be answered by any tool (e.g., "why is Salem underperforming"), call the closest metrics AND flag `needsInterpretation: true`.
- If completely out of scope (weather, policy wording, medical advice), return tool `none` with a polite scope message.
```

### 7.3 Narrator rules
- Answer in ≤4 sentences + optional table/chart. Lead with the number.
- Match user's language register (Tanglish in → Tanglish out).
- When `needsInterpretation`, clearly separate fact ("Salem conversion is 34% vs territory 62%") from hypothesis ("mostly tele-UW pending cases — worth checking with the branch").
- Always offer one relevant follow-up ("Break it by agent?").

### 7.4 Fallback: sandboxed analysis (Phase 4, optional)
For novel questions the catalog can't serve: run a whitelisted read-only SQL template or a sandboxed compute over the snapshot; display the generated query alongside the answer. Never enabled silently — answer says "computed ad-hoc".

### 7.5 Conversation memory
Persist ChatMessage rows; send last 10 turns to router for follow-up resolution ("and by agent?" inherits prior filters).

---

## 8. UI / SCREENS

Design system: shadcn/ui, dark-first, DigitalVetri signature **heat-bar left-edge state indicator** on cards/rows:
green=Won, amber=Pending, red=Needs action (TELE_UW_REQUIRED, REQUIREMENT_RAISED, COUNTER_OFFER), grey=Review.

### 8.1 Layout
- Left sidebar: Pulse · Branches · Pipeline · Products · People · Cases · Uploads. Persistent right-side **chat drawer** (collapsible, keyboard shortcut `/`).
- Top bar: snapshot switcher (dropdown of uploads, newest default) + "Compare with…" picker + global filter chips (branch, product, stage).
- Global filters apply to every view AND pre-fill bot filter context.

### 8.2 Screens
**S1 Pulse (landing after upload)**
- 4 KPI cards: Logged Premium, Issued Premium, Conversion %, Stuck Premium (each with WoW delta when a comparison snapshot exists).
- Attention banner (auto): top stuck insight, e.g. "₹15.5L stuck across 30 cases — 8 need tele-UW".
- Mini funnel bar + daily trend sparkline + top/bottom branch strip.

**S2 Branches** — leaderboard table (metric premium_by_branch), click → branch detail: agents, funnel, stuck list scoped to branch.

**S3 Pipeline** — Kanban columns by FunnelStage bucket; cards show customer, premium, agent, ageing badge (ageing ≥7 pulses red); heat-bar edge. Card click → case sheet (full detail incl. riders JSON prettified, raw row toggle). "Nudge on WhatsApp" button on pending cards (§9).

**S4 Products** — genre donut + ticket-size histogram + tenure mix + plan-type split.

**S5 People** — AM → Agent tree (am_leaderboard + agent_leaderboard), conversion% color scale, stuck-count badge per node.

**S6 Cases** — full filterable/sortable table (server pagination), CSV export of filtered view.

**S7 Uploads** — snapshot list, row counts, ingestion issues drawer, re-upload.

### 8.3 Charts
Recharts. Bar (branch, funnel), donut (product), line (trend), histogram (ticket size). Every chart has "Ask about this" button → opens chat pre-filled with the chart's context filters.

---

## 9. WHATSAPP NUDGE (differentiator)

Flow: Pipeline card → "Nudge" → modal shows AI-drafted message (Narrator generates from case context, editable):

> "Hi {agentName}, case {applicationNo} — {customerName}, ₹{loggedPremium} ({productGenre}) is pending at *{leadStatus}* for {ageing} days. Please complete the requirement today. — {THName}"

POST /nudge → NudgeLog(QUEUED) → n8n webhook → WhatsApp Cloud API template message → callback updates status.
v1 scope: agent phone numbers uploaded as a simple mapping CSV (agent_code → phone) in Settings; missing phone → copy-to-clipboard fallback.
Guardrail: max 20 nudges/day/user; all logged.

---

## 10. AUTH & MULTI-TENANCY

- Supabase Auth (email OTP + Google). On signup → create Tenant + User (TERRITORY_HEAD).
- JWT custom claim `tenant_id` via Supabase hook. RLS per §3.
- v1 ships single-role; schema supports branch-scoped roles for upsell without migration.

---

## 11. NON-FUNCTIONALS

- **Accuracy:** metric unit tests against a fixture CSV (use the real 81-row sample, commit as `fixtures/nb_sample.csv` with names pseudonymized via script `scripts/anonymize.ts`). Expected values hard-coded in tests (see §14 seed numbers).
- **Perf:** dashboard TTI ≤ 3 s post-ingest (all metrics are indexed GROUP BYs).
- **Privacy:** raw files private bucket; PII (names, customer_id) never sent to LLM in router step — router receives only the question + catalog; narrator receives aggregates; row-level answers (stuck_cases, case_lookup) send only the rows needed for that answer.
- **Audit:** toolTrace on every bot answer; ingestion issues retained.
- **i18n:** UI English v1; bot multilingual from day 1.

---

## 12. BUILD PHASES

**Phase 1 — Ingestion + Metric Engine (Week 1)**
Prisma schema · migrations · upload API · full §2 normalization · metrics: totals, premium_by_branch, funnel, stuck_summary, stuck_cases, agent_leaderboard · unit tests green against fixture.
✅ Exit: `curl /api/metrics/totals?snapshotId=…` returns logged ₹31,77,434 / issued ₹16,29,060 / 50 of 81 issued for the fixture file.

**Phase 2 — Dashboard core (Week 2)**
S1 Pulse, S2 Branches, S3 Pipeline, S6 Cases, S7 Uploads · snapshot switcher · global filters.
✅ Exit: upload → Pulse renders ≤10 s; Kanban drag disabled (read-only); heat-bars correct.

**Phase 3 — Bot (Week 3)**
Metric catalog as tools · router + narrator · chat drawer with SSE streaming · provenance chips · conversation memory · 40-question test set passing.
✅ Exit: "Salem la evlo pending irukku?" → correct ₹ figure + case count + chart, in Tanglish.

**Phase 4 — Compare + Actions (Week 4)**
snapshot_compare across all metrics · WoW deltas on KPI cards · S4 Products, S5 People · WhatsApp nudge flow via n8n · Settings (threshold, agent phone mapping).
✅ Exit: upload two files → "which branches improved this week?" answered; nudge delivered to sandbox WABA number.

**Phase 5 — Hardening (Week 5)**
RLS audit · rate limits · error observability (Sentry) · empty/failed-upload states · demo tenant with seeded data · landing page.

---

## 13. EDGE CASES (test all)

1. BOM in header (present in real file) — first column must not become `﻿First Name`.
2. Trailing fully-blank row → skipped with info issue, not counted.
3. "Unlimited" sum assured → is_unlimited_si, excluded from SI averages.
4. Duplicate customer in file (e.g., same name two apps — real: SM Vijaya Baskaran ×2) → both kept, distinct applicationNo.
5. Agent ".NONE." → UNASSIGNED bucket, shown in leaderboard last with warning icon.
6. Case with logged_date but blank issued fields and blank sales_status → funnelStage UNKNOWN, bucket Review.
7. Mixed-case branch/state duplicates must merge (ERODE + Erode = one branch).
8. Loading Premium > 0 with issued (real: TVS Rao ₹8,455 loading) → surfaced in case sheet.
9. Issued Premium > Logged Premium (loading) → conversion math uses issued where issued.
10. Customer state outside TN (Karnataka, Telangana rows exist) → geo_customer shows them; branch views unaffected.
11. Re-upload identical file → dedupe by hash, friendly message.
12. CSV with 50% unknown columns → FAILED with clear format error.
13. Bot asked about a person not in data → "No case found for X in this report", zero hallucination.
14. Bot asked out-of-scope ("IRDAI rule?") → polite scope decline.

---

## 14. BOT ACCURACY TEST SET (seed — expand to 40)

Fixture = real sample (81 rows). Ground truths:
| # | Question | Expected core answer |
|---|---|---|
| 1 | Total logged premium? | ₹31.77L (3,177,434) |
| 2 | How much premium issued? | ₹16.29L |
| 3 | Conversion rate? | 50/81 ≈ 61.7% |
| 4 | Which branch logged the most? | Salem — ₹8.58L, 21 cases |
| 5 | Kovai la evlo cases? | Coimbatore — 11 cases, ₹4.29L logged |
| 6 | How much is stuck in underwriting? | UNDERWRITING stage cases + premium from funnel metric |
| 7 | Biggest stuck case? | NAGARAJAN P — ₹1,45,951, Tele UW required |
| 8 | Top agent? | K SIVAPRAKASH — ₹2.97L, 6 cases |
| 9 | Best agency manager? | Swetha Mahadevan — ₹3.13L logged |
| 10 | Port cases evlo? | count where isPortability, with premium |
| 11 | Reassure Black premium? | ₹11.41L, 18 cases |
| 12 | Any discrepancy cases? | list incl. SARITHA N (Central Discrepancy) |
| 13 | Cases pending more than 5 days? | ageing_buckets 8–14 & 15+ rows |
| 14 | Compare with last week (2 snapshots) | snapshot_compare deltas |
| 15 | Yaaru follow up pannanum innaiku? | high_value_stuck top 5 + agent names |

Rule: every answer's numbers must exactly equal metric-engine output. Add remaining 25 questions across filters, Tanglish variants, and follow-up chains.

---

## 15. FUTURE ROADMAP (do not build now)

- Renewal report + claims report ingestion (same fingerprint framework → multi-report joins).
- Scheduled email/WhatsApp Monday digest (n8n cron: auto-summary of latest snapshot).
- Voice bot via Sarvam AI (Tamil STT/TTS) — architecture already supports (bot is API-first).
- Branch-manager self-serve logins (RLS ready).
- Target vs achievement module (TH uploads targets sheet).
- Insurer-agnostic column-mapping wizard UI → sell to any insurer's territory heads.

---

*End of spec. Build Phase 1 first. When in doubt: deterministic metrics, loud failures, Indian number formatting.*
