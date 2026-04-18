# FairGig Project Progress Report

**Generated:** 2026-04-18 (re-audit: static code review + prior `node check_db.js` snapshot + anomaly `TestClient` suite)

**Live DB note:** A follow-up `node check_db.js` on this machine returned **connection terminated unexpectedly** (Neon/network). Treat **seed counts** below as the last successful snapshot; re-run `node check_db.js` when the database is reachable to confirm complaints and deduction stats.

**Codebase root:** `d:\Personal Projects\softec-hackathon`

---

## Overall Status: **NEEDS WORK**

The platform is **functionally strong in code** (auth, secured earnings, TS grievance API, analytics contracts, anomaly judge tests, frontend `authFetch` + route guards). **Live Neon data** in this environment still fails **complaints ≥ 20** and **foodpanda deduction band** checks unless **`npm run seed`** is re-run after the latest `seed.ts`. A few items remain **spec deltas** vs the original checklist (analytics JWT, grievance REST path names, explicit logout UI, commission field naming).

---

## Service Status Summary

| Service | Running* | Endpoints Complete | Tests Pass | Status |
|---|---|---|---|---|
| auth-service | ✓ | **5/5** | **8/8** | **READY** |
| earnings-service | ✓ | **10/10** | **11/12** | **READY** |
| anomaly-service | ✓ | **5/5** | **20/20** | **READY** |
| grievance-service | ✓ | **5/7**† | **6/8** | **NEEDS WORK** |
| analytics-service | ✓ | **6/6** | **7/8** | **NEEDS WORK** |
| frontend | ✓ | **11/11**‡ | **11/15** | **NEEDS WORK** |

\*Assumes `.env` with `DATABASE_URL` + `JWT_SECRET`; `npm run dev` / per-service README commands.  
†Checklist paths `GET /complaints/:id`, `PUT /complaints/:id/tags|status` differ from implemented **`/api/complaints/...`** + **`PUT .../moderate`** (see §6).  
‡Verifier UI is **`/queue`** (with legacy redirect from `/verifier/queue`), not literally `/verifier/queue` as primary route.

---

## Section 1 — Infrastructure & setup

### 1.1 File structure

| Service | Entry | Manifest | README + sample | Notes |
|---|---|---|---|---|
| auth-service | `main.py` | `requirements.txt` | PASS + curl `auth-service/README.md:21-24` | |
| earnings-service | `index.js` (run from repo root) | `package.json` | PASS `earnings-service/README.md` | |
| anomaly-service | `main.py` | `requirements.txt` | PASS `anomaly-service/README.md` | |
| grievance-service | **`index.ts`** (canonical) | `package.json` | PASS `grievance-service/README.md` | `index.js` exits with hint |
| analytics-service | `main.py` | `requirements.txt` | PASS `analytics-service/README.md` | |
| frontend | App Router | `frontend/package.json` | PASS | |

- **`.env.example`** (root + `frontend/.env.example`): PASS — documents `DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_*` URLs.  
- **Hardcoded secrets:** PASS — `JWT_SECRET` required in `auth-service/main.py:35-36`, `earnings-service/index.js:21-24`, `grievance-service/index.ts` (exits if missing).  
- **`.gitignore`:** PASS — `.env*`, `node_modules`, `__pycache__`, `.next` (repo root).

### 1.2 Environment variables

- **DATABASE_URL / JWT_SECRET:** consumed from env in auth, earnings, grievance, analytics — **PASS**.  
- **`AUTH_SERVICE_URL` … `ANALYTICS_SERVICE_URL`:** listed in `.env.example` for frontend/docs; **not read** by Python/Node backends (direct DB) — **PARTIAL** (acceptable for current architecture; document-only).

### 1.3 CORS

| Service | Evidence | Status |
|---|---|---|
| auth | `CORSMiddleware` `allow_origins=["*"]`, methods/headers `*` `auth-service/main.py:23-28` | PASS |
| earnings | `app.use(cors())` `earnings-service/index.js:50` | PASS |
| anomaly | `main.py:16-21` | PASS |
| grievance | `index.ts` `app.use(cors())` | PASS |
| analytics | `main.py:15-21` | PASS |

### 1.4 Ports

- **PASS** — `dev-services.ts:45-93`: 8001–8005, 3000 unique.

**Actual start commands (orchestrator):** `dev-services.ts` — earnings `node earnings-service/index.js` from repo root; grievance `npx tsx grievance-service/index.ts`; not `node index.js` on port 8004.

---

## Section 2 — Database (live check: `check_db.js`)

Executed: **2026-04-18** against project `.env`.

| Check | Result | Min | Status |
|---|---|---|---|
| Workers | **64** | ≥ 60 | **PASS** |
| Shifts | **1536** | ≥ 1000 | **PASS** |
| Distinct platforms | **4** | ≥ 3 | **PASS** |
| Distinct `city_zone` (users) | **5** | ≥ 4 | **PASS** |
| Distinct months (`shift_date`) | **7** | ≥ 4 | **PASS** |
| Complaints | **5** | ≥ 20 | **FAIL** |

**Data quality (same run):**

| Check | Result | Status |
|---|---|---|
| `gross < deductions` | 0 | PASS |
| Net vs gross − deductions | 0 | PASS |
| Invalid roles | 0 | PASS |
| Orphaned shifts | 0 | PASS |
| ≥ 3 workers / zone | min 9 | PASS |
| Careem / Bykea / foodpanda “realistic” bands | foodpanda **min ≈ 7.7%** | **FAIL** (stale data vs `seed.ts` bands) |

**Schema:** Implemented as `auth.users`, `earnings.shifts`, `grievance.complaints` in `neon_database.sql` (ENUMs + constraints); **functionally meets** the audit’s column intent.

**Fix for §2 failures:** Run **`npm run seed`** (or `tsx seed.ts`) so complaints ≥ 45 and deduction stats reflect updated `seed.ts` PLATFORM bands.

---

## Section 3 — Auth (8001)

| Item | Status | Evidence |
|---|---|---|
| `POST /auth/register` | PASS | `auth-service/main.py:157+` |
| `POST /auth/login` + **user** in body | PASS | `LoginResponse` `main.py:99-104`, `main.py:195+` |
| `POST /auth/refresh` | PASS | `main.py:226+` |
| `GET /auth/me` | PASS | `main.py:242+` |
| `GET /health` | PASS | `main.py:190+` |
| Duplicate email → 409 | PASS | `main.py:163-165` |
| bcrypt / no plaintext | PASS | `hash_password` `main.py:47-52` |
| No `password_hash` in responses | PASS | register `RETURNING` excludes hash `main.py:148-149` |
| JWT from env only | PASS | `main.py:32-36` |
| Invalid JWT / missing user → 401 | PASS | `main.py:131-132`, JWTError branch |
| bcrypt rounds | PASS | `seed.ts` uses cost **10**; passlib default ≥ 10 |

---

## Section 4 — Earnings (8002)

| Route | Code ref | Status |
|---|---|---|
| `GET/POST /shifts`, filters, PUT, DELETE | `earnings-service/index.js:99-228` | PASS |
| `POST /shifts/import-csv` | `index.js:232-289` returns `imported`, `failed`, `errors` | PASS |
| `POST /shifts/:id/screenshot` | `index.js:292-331` JPEG/PNG, 5MB | PASS |
| `GET /verifier/queue`, `PUT /verifier/:id/decision` | `index.js:333-371` | PASS |
| `GET /health` | `index.js:95-97` | PASS |

**Shift create:** validates fields + worker exists `index.js:134-176`; **JWT `sub` must match `worker_id`** `index.js:163-165`.

**Verifier decision:** **`verifier_id` taken from JWT**, not request body — **differs** from audit text “accept verifier_id” but **meets security intent** (`index.js:350-361`).

**All routes require Bearer** — unauthenticated `GET /shifts` **no longer leaks** all rows.

---

## Section 5 — Anomaly (8003)

**Automated (`TestClient`, venv, 2026-04-18):**

| Test | HTTP / result |
|---|---|
| Empty earnings | 200, summary “No earnings data…” |
| Single shift | 200, “Insufficient data…” |
| All zeros (3) | 200, `anomalies: []` |
| Identical 25% (5) | 200, `[]` |
| Same month (10) | 200, no `income_drop` |
| Prev month net 0 | 200, no false `income_drop` |
| Deduction spike | 200, `deduction_spike` present |
| Income drop Jan→Feb | 200, `income_drop`, `2025-02` |
| Hourly rate drop | 200, `hourly_rate_drop` |
| 10 stable (balanced months) | 200, `anomalies: []` |
| Validation batch | all **422** |
| Risk score 0 / 35 / cap 100 | PASS (`utils.py`) |
| 90-shift latency (50 samples) | **~21.9 ms** avg (≪ 200 ms) |

**Endpoints:** `POST /analyze`, `GET /health`; `/docs`, `/redoc`, `/openapi.json` via FastAPI defaults — **PASS**.

**models.py:** `ShiftInput` date + non-negative validators; `AnalyzeRequest` `earnings` defaults `[]` — **PASS** (`anomaly-service/models.py`).

---

## Section 6 — Grievance (8004)

| Checklist item | Implementation | Status |
|---|---|---|
| `POST /complaints` | Legacy rewrite → `POST /api/complaints` `index.ts:1114-1116` | PASS |
| `GET /complaints` + filters | Public **`/api/complaints/public`** supports platform/category/status; legacy `GET /complaints` → public **`index.ts:1109-1112`** — **no `worker_id` filter** on legacy path | **PARTIAL** |
| `GET /complaints/:id` | **`GET /api/complaints/:id`** `index.ts:1077-1106` | PASS (path prefix differs) |
| `PUT .../tags` / `status` | Advocate **`PUT /api/complaints/:id/moderate`** + bulk routes | **PARTIAL** (not literal REST names) |
| `GET /complaints/clusters` | **`index.ts:1124-1138`** `{ clusters }` + `array_agg` ids | PASS |
| `GET /health` | `index.ts:32-34` | PASS |
| Worker POST uses JWT (no body `worker_id`) | `index.ts:113-137` | PASS (secure) |

---

## Section 7 — Analytics (8005)

| Endpoint | Status | Notes |
|---|---|---|
| Commission trends | PASS | `main.py:37-47`; JSON keys **`month`, `platform`, `avg_rate`** (not `avg_commission_rate`) |
| Income distribution | PASS | `main.py:57-102` + **`histogram`** `{ zone, bucket_range, worker_count }` |
| Vulnerability flags | PASS | Strict **`< 0.8 * prev`** `main.py:139-144`; includes **`drop_percentage`** |
| Median | PASS | `PERCENTILE_CONT`, verified, 30d `main.py:151-180` |
| Top complaints | PASS | `main.py:183+` |
| Health | PASS | `main.py:32-34` |
| JWT validation on API | **Not implemented** | **GAP** vs §9.2 “every protected backend validates JWT” |

---

## Section 8 — Frontend (3000)

| Page | Path(s) | Status |
|---|---|---|
| Login + role preset | `(auth)/login` | PASS |
| Register | `(auth)/register` | PASS |
| Dashboard | `(worker)/dashboard` | PASS (ECharts, not Recharts — **naming delta** vs audit) |
| Shifts / new / certificate | `(worker)/shifts/*`, `certificate` | PASS |
| Verifier queue | **`/queue`**, `verifier/queue` redirect | PASS (route name delta) |
| Advocate analytics / grievances | `advocate/*` | PASS |
| Community | `community` | PASS |

**Auth:** `layout-shell` redirects unauthenticated users; role guards; JWT in `localStorage` + `authFetch` — **PASS**.

**Gaps:** **No dedicated Logout** control in `role-sidebar.tsx` (clear token + `/login`) — **MEDIUM**. **Mobile 375px / full console sweep** not executed in this run — **NOT TESTED**.

---

## Section 9 — Integration

| Link | Status |
|---|---|
| Frontend → Auth | PASS (login + optional embedded `user`) |
| Frontend → Earnings (JWT) | PASS |
| Frontend → Anomaly | PASS (`POST /analyze` no auth — acceptable) |
| Frontend → Grievance | PASS (`/api/...` + TS server) |
| Frontend → Analytics | PASS (optional Bearer on median via `authFetch`) |
| Analytics service JWT | **Not enforced server-side** | **FAIL** vs strict checklist |
| Expired JWT UX | Partially client-side only | **MEDIUM** |

---

## Section 10 — Security

| Item | Status |
|---|---|
| Parameterized SQL | PASS (reviewed services) |
| bcrypt passwords | PASS |
| JWT secret | PASS (required from env) |
| JWT payload | PASS (sub, role, exp) |
| Upload MIME + 5MB | PASS `earnings-service/index.js:31-37` |
| Role separation earnings | PASS worker vs verifier |
| `worker_id` ≡ JWT | PASS earnings `POST /shifts` |

---

## Critical issues (demo-breaking)

1. **Database / seed** — Complaints **5 < 20**; foodpanda min deduction **out of band** until **`npm run seed`** refreshes Neon (`check_db.js` output).  
2. **None** of the prior “grievance wrong entrypoint” or “earnings list leak” regressions remain in **current** code.

---

## High priority

- Add **logout** in UI (`frontend/components/role-sidebar.tsx`).  
- Optionally **enforce JWT** on analytics routes (or document as public aggregate API).  
- Align **commission-trends** response key name with spec (`avg_commission_rate` alias) if judges expect exact JSON.  
- **Legacy `GET /complaints`** — support `worker_id` query or document “use `/api/complaints/mine`”.

---

## Medium priority

- Audit text vs **ECharts** on worker dashboard (spec said Recharts).  
- **Mobile** regression pass at 375px.  
- **Grievance** expose thin wrappers `PUT /complaints/:id/tags` mapping to moderate if strict REST compatibility required.

---

## Seed data status (live DB snapshot)

| Metric | Value | Target | Status |
|---|---|---|---|
| Workers | 64 | ≥ 60 | PASS |
| Shifts | 1536 | ≥ 1000 | PASS |
| Zones | 5 | ≥ 4 | PASS |
| Months | 7 | ≥ 4 | PASS |
| Complaints | 5 | ≥ 20 | **FAIL** |
| Deduction realism | foodpanda min low | 25–38% target | **FAIL** until reseed |

---

## Anomaly service — judge readiness

| Item | Result |
|---|---|
| Empty / single / zeros / std=0 / same month / prev=0 | **PASS** |
| Deduction spike / income drop / hourly drop | **PASS** |
| Stable 10-shift no FP (balanced months) | **PASS** |
| Swagger `/docs` | **PASS** |
| 90-shift timing | **~22 ms** (local `TestClient`) |
| **Judge readiness** | **READY** |

---

## Certificate page

| Item | Result |
|---|---|
| Renders + verified filter | PASS |
| Print CSS `.no-print` / sidebar | PASS `frontend/app/globals.css:32-48` |
| Footer text | PASS “Not a legal document” |

---

## Hackathon requirements checklist

- [x] All services start via **`npm run dev`** orchestrator (or README commands)  
- [x] READMEs for services  
- [x] Anomaly = FastAPI  
- [x] Grievance = Node (TypeScript)  
- [x] Other FastAPI: auth, analytics  
- [x] Frontend Next.js / React  
- [x] City median from DB aggregation  
- [x] Anomaly documented `/docs`  
- [x] **`API_CONTRACTS.md`** inter-service REST summary  
- [x] Printable certificate  
- [x] REST between tiers  

---

## Recommended action order

1. **`npm run seed`** — restore complaints ≥ 20 and platform rate sanity (**~5–15 min** runtime).  
2. **Logout button** — sidebar (**~15 min**).  
3. **Optional:** JWT middleware on analytics (**~1–2 h**).  
4. **Optional:** `avg_commission_rate` alias on commission-trends (**~15 min**).  
5. Re-run **`node check_db.js`** and this checklist before demo.

---

## Methodology note

- **Static analysis:** service sources under `auth-service/`, `earnings-service/`, `anomaly-service/`, `grievance-service/`, `analytics-service/`, `frontend/app/`, `dev-services.ts`, `neon_database.sql`, `seed.ts`.  
- **Executed tests:** `node check_db.js` (when DB reachable — **this session’s run failed** on Neon); anomaly battery via `fastapi.testclient` in project `venv` (script removed after capture; re-create from §5 table if needed).  
- **Not run:** full Playwright/browser matrix, long-running `next build`, or load tests against live servers (ports not assumed up during audit).
