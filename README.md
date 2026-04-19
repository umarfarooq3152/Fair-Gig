# FairGig — SOFTEC 2026 Web Dev Competition

FairGig is an end-to-end gig worker income transparency and rights platform with role-based workflows across six services.

Manual one-by-one startup guide: `README_MANUAL_SERVICES.md`

## Manual Separate Run (One by One)

Use this when you want to start each backend service manually in separate terminals, then run the full UI on `3000`.

### 0) Install dependencies once (repo root)

```bash
npm install
npm install --prefix frontend
```

For Python services (recommended with venv):

```bash
python -m venv venv
venv\Scripts\pip install -r auth-service\requirements.txt -r anomaly-service\requirements.txt -r analytics-service\requirements.txt
```

### 1) Start services one by one (separate terminals)

Terminal 1 (Auth - 8001):

```bash
cd auth-service
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

Terminal 2 (Earnings - 8002):

```bash
cd earnings-service
node index.js
```

Terminal 3 (Anomaly - 8003):

```bash
cd anomaly-service
uvicorn main:app --host 0.0.0.0 --port 8003 --reload
```

Terminal 4 (Grievance - 8004):

```bash
cd grievance-service
node index.js
```

Terminal 5 (Analytics - 8005):

```bash
cd analytics-service
uvicorn main:app --host 0.0.0.0 --port 8005 --reload
```

Terminal 6 (Certificate Renderer - 8006):

```bash
cd certificate-renderer
npm install
npm start
```

### 2) Run full app (frontend) on port 3000

Terminal 7:

```bash
npm run dev:frontend
```

Open: `http://localhost:3000`

### Quick checks

- Auth health: `http://127.0.0.1:8001/health`
- Frontend: `http://localhost:3000`
- FastAPI docs: `http://localhost:8001/docs`, `http://localhost:8003/docs`, `http://localhost:8005/docs`

## Service Stack

- Frontend (Next.js 15): `3000`
- Auth Service (FastAPI): `8001`
- Earnings Service (Node.js): `8002`
- Anomaly Service (FastAPI): `8003`
- Grievance Service (Node.js): `8004`
- Analytics Service (FastAPI): `8005`
- Certificate Renderer (Node.js): `8006`

## Two frontends (important)

| UI | Location | Default URL | Advocate “new” dashboard |
|----|----------|---------------|---------------------------|
| **Primary (Next.js)** | `frontend/` | **`http://localhost:3000`** | **`/advocate/analytics`** |
| Legacy (Vite SPA) | `src/` + `index.html` | **`http://localhost:5173`** (see `vite.config.ts`) | **Analytics panel** (first sidebar item); data matches Next |

If you run **`vite` on port 3000** or anything else binds 3000 before `dev-services.ts`, the orchestrator **skips** starting Next — you may only see the old shell. Use **`npm run dev:frontend`** for the Next app, or **`npm run dev:vite`** for the Vite shell on 5173.

## Monorepo Structure

- `frontend/`
- `auth-service/`
- `earnings-service/`
- `anomaly-service/`
- `grievance-service/`
- `analytics-service/`
- `certificate-renderer/`
- `.env.example`
- `schema.sql`
- `seed.ts`
- `API_CONTRACTS.md`
- `fairgig.postman_collection.json`

## Environment Setup

1. Copy root env:
   - `cp .env.example .env`
2. Put Neon PostgreSQL URL in `DATABASE_URL`.
3. Apply schema and seed data:
   - `npm install`
   - `npm run seed`

## Run Commands

### Auth Service (8001)
- Install: `pip install -r auth-service/requirements.txt`
- Start: `cd auth-service && uvicorn main:app --port 8001 --reload`

### Earnings Service (8002)
- Install: `npm install`
- Start: `cd earnings-service && node index.js`

### Anomaly Service (8003)
- Install: `pip install -r anomaly-service/requirements.txt`
- Start: `cd anomaly-service && uvicorn main:app --port 8003 --reload`

### Grievance Service (8004)
- Install: `npm install`
- Start: `cd grievance-service && node index.js`

### Analytics Service (8005)
- Install: `pip install -r analytics-service/requirements.txt`
- Start: `cd analytics-service && uvicorn main:app --port 8005 --reload`

### Certificate Renderer (8006)
- Install: `cd certificate-renderer && npm install`
- Start: `cd certificate-renderer && npm start`

### Frontend (3000)
- Install: `cd frontend && npm install` (required so `next` is available; the dev script uses `npx next`.)
- Env: `cp .env.example .env.local`
- Start: `npm run dev` from `frontend/`, or from repo root: `npm run dev:frontend`

### Orchestrator (`npm run dev` from repo root)
- Starts FastAPI with **`resolvePython()`**: `PYTHON_CMD` from `.env`, else `./venv/Scripts/python.exe` (Windows) or `./venv/bin/python3`, else `python` / `python3`. **Never uses `py -3`.**
- Install deps into **that** interpreter or the venv, or you get `No module named uvicorn`:
  - `python -m venv venv`
  - Windows: `.\venv\Scripts\pip install -r auth-service\requirements.txt -r anomaly-service\requirements.txt -r analytics-service\requirements.txt`
- Starts **Next** with `cwd` = `frontend/` and `npm run dev` (so `next` resolves from `frontend/node_modules`). Run **`npm install --prefix frontend`** once.
- **FairGig Workspace** (advocate/worker shell in `src/`): `npm run dev:vite` → port **5173**. Next on **3000** is the App Router marketing + role routes; both talk to the same REST APIs.

## Demo Story Checklist

1. Worker logs in and opens dashboard (charts + city median).
2. Worker logs a new shift and uploads screenshot.
3. Verifier opens queue and approves screenshot.
4. Worker runs anomaly check and sees alerts.
5. Worker posts complaint on community board.
6. Advocate views analytics and vulnerability flags.
7. Advocate tags/escalates complaint.
8. Worker opens certificate page and prints.

## Data and Scope Notes

- Single PostgreSQL database with service schemas: `auth`, `earnings`, `grievance`, `analytics`.
- Seed script creates 60 workers, 6 months of shifts, realistic city-zone variance, and deduction spikes.
- `POST /analyze` is robust for short/edge payloads and returns `200` with empty anomalies when data is insufficient.
- Certificate page is print-friendly via `@media print` styles.

## API Documentation

- Endpoint table: `API_CONTRACTS.md`
- Postman collection: `fairgig.postman_collection.json`
- FastAPI docs:
  - Auth: `http://localhost:8001/docs`
  - Anomaly: `http://localhost:8003/docs`
  - Analytics: `http://localhost:8005/docs`
