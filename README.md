# FairGig — SOFTEC 2026 Web Dev Competition

FairGig is an end-to-end gig worker income transparency and rights platform with role-based workflows across six services.

## Service Stack

- Frontend (Next.js 15): `3000`
- Auth Service (FastAPI): `8001`
- Earnings Service (Node.js): `8002`
- Anomaly Service (FastAPI): `8003`
- Grievance Service (Node.js): `8004`
- Analytics Service (FastAPI): `8005`

## Monorepo Structure

- `frontend/`
- `auth-service/`
- `earnings-service/`
- `anomaly-service/`
- `grievance-service/`
- `analytics-service/`
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

### Frontend (3000)
- Install: `cd frontend && npm install`
- Env: `cp .env.example .env.local`
- Start: `npm run dev`

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
