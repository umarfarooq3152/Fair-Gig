# FairGig

A gig worker income transparency and rights platform. FairGig gives workers visibility into their earnings, flags anomalous deductions, surfaces grievances, and generates official income certificates — with a separate advocate dashboard for tracking systemic patterns.

Built for SOFTEC 2026 Web Dev Competition.

## What it does

- **Workers** log shifts, upload payment screenshots, run anomaly checks on their earnings, and file complaints
- **Verifiers** review uploaded screenshots and approve/reject entries
- **Advocates** view analytics across the worker pool, identify vulnerability patterns, and escalate complaints
- **Certificates** — workers can generate and print official income certificates

## Services

| Service | Stack | Port | Responsibility |
|---|---|---|---|
| Frontend | Next.js 15 | 3000 | App Router UI for all roles |
| Auth Service | FastAPI | 8001 | Authentication, JWT |
| Earnings Service | Node.js | 8002 | Shift logging, screenshot uploads |
| Anomaly Service | FastAPI | 8003 | Statistical anomaly detection on earnings |
| Grievance Service | Node.js | 8004 | Community complaint board |
| Analytics Service | FastAPI | 8005 | Aggregate analytics, vulnerability flags |
| Certificate Renderer | Node.js | 8006 | Print-ready income certificates |

## Tech Stack

- **Frontend:** Next.js 15 (App Router), React, Tailwind CSS
- **Backend:** FastAPI (Python) + Node.js/Express microservices
- **Database:** PostgreSQL (Neon) — single DB, per-service schemas (`auth`, `earnings`, `grievance`, `analytics`)
- **Seed data:** 60 workers, 6 months of shifts, realistic city-zone variance and deduction spikes

## Quick start

### Prerequisites
- Node.js 18+, Python 3.11+
- A [Neon](https://neon.tech) PostgreSQL database

### 1. Install and configure

```bash
git clone https://github.com/umarfarooq3152/Fair-Gig.git
cd Fair-Gig

npm install
npm install --prefix frontend

cp .env.example .env
# Set DATABASE_URL to your Neon connection string
```

For Python services:

```bash
python -m venv venv
# Windows:
venv\Scripts\pip install -r auth-service\requirements.txt -r anomaly-service\requirements.txt -r analytics-service\requirements.txt
# Linux/Mac:
venv/bin/pip install -r auth-service/requirements.txt -r anomaly-service/requirements.txt -r analytics-service/requirements.txt
```

### 2. Apply schema and seed

```bash
npm run seed
```

### 3. Start all services

Run each in a separate terminal:

```bash
# Auth (8001)
cd auth-service && uvicorn main:app --port 8001 --reload

# Earnings (8002)
cd earnings-service && node index.js

# Anomaly (8003)
cd anomaly-service && uvicorn main:app --port 8003 --reload

# Grievance (8004)
cd grievance-service && node index.js

# Analytics (8005)
cd analytics-service && uvicorn main:app --port 8005 --reload

# Certificate Renderer (8006)
cd certificate-renderer && npm install && npm start

# Frontend (3000)
npm run dev:frontend
```

Open: `http://localhost:3000`

FastAPI docs: [`/8001/docs`](http://localhost:8001/docs) · [`/8003/docs`](http://localhost:8003/docs) · [`/8005/docs`](http://localhost:8005/docs)

## Demo flow

1. Worker logs in → opens dashboard with earnings charts and city median
2. Worker logs a shift and uploads payment screenshot
3. Verifier approves the screenshot
4. Worker runs anomaly check → sees flagged deductions
5. Worker files a complaint on the community board
6. Advocate views analytics and vulnerability flags
7. Advocate escalates the complaint
8. Worker generates and prints income certificate

## API

- Endpoint contracts: `API_CONTRACTS.md`
- Postman collection: `fairgig.postman_collection.json`
