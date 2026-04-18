# Analytics Service

FastAPI aggregate analytics for city medians, vulnerability flags, and advocate dashboards.

Install command:
`pip install fastapi uvicorn psycopg2-binary python-dotenv`

Start command:
`uvicorn main:app --port 8005 --reload`

Environment variables:
- `DATABASE_URL`

Endpoints:
- `GET /health`
- `GET /analytics/commission-trends` — Monthly platform commission rates (6 months)
- `GET /analytics/income-distribution` — `{ zones: [...], histogram: [{ zone, bucket_range, worker_count }] }`
- `GET /analytics/vulnerability-flags` — Workers with >20% MoM income drop (`drop_percentage` included)
- `GET /analytics/median/:category/:zone` — `{ median_hourly_rate, median_hourly, sample_size, category, zone }`
- `GET /analytics/top-complaints` — Top grievance categories in last 7 days
