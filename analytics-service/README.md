# Analytics Service

FastAPI aggregate analytics for city medians, vulnerability flags, and advocate dashboards.

Install command:
`pip install fastapi uvicorn psycopg2-binary python-dotenv`

Start command:
`uvicorn main:app --port 8005 --reload`

Environment variables:
- `DATABASE_URL`

Endpoints:
- `GET /analytics/commission-trends` — Monthly platform commission rates (6 months)
- `GET /analytics/income-distribution` — Zone-wise income histogram buckets
- `GET /analytics/vulnerability-flags` — Workers with >20% MoM income drop
- `GET /analytics/median/:category/:zone` — 30-day city median hourly for worker category/zone
- `GET /analytics/top-complaints` — Top grievance categories in last 7 days
