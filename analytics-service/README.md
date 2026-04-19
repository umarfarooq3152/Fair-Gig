# Analytics Service (Port 8005)

The Analytics Service drives the Advocate dashboards. It queries live, anonymous materialized views utilizing K-Anonymity constraints (K=5 floor limit).

## Tech Stack
Available in both **Node.js (Express)** AND **Python (FastAPI)**.

## How to run (FastAPI Version - Competition Default)
```bash
# From this directory
python -m venv venv
venv\Scripts\activate  # Windows
# or: source venv/bin/activate # Mac/Linux

pip install -r requirements.txt
uvicorn main:app --port 8005 --reload
```

## How to run (Node.js Version)
```bash
# From this directory
npm install
npm run dev
```

## API Contracts
See the root `/API_CONTRACTS.md` for full parameter definitions.
- `GET /analytics/advocate-summary`
- `GET /analytics/income-by-zone-category`
- `GET /analytics/commission-trends`
- `GET /analytics/income-distribution`
- `GET /analytics/vulnerability-flags`
- `GET /analytics/median/{category}/{zone}`
- `GET /analytics/top-complaints`
- `GET /analytics/city-zone-medians`
- `GET /analytics/verifier-queue`
- `GET /analytics/anomaly-logs`
- `GET /analytics/commission-snapshots`
- `GET /health`
