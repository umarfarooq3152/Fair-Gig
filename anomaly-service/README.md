# Anomaly Service

FastAPI anomaly detector for deduction spikes, income drops, and hourly-rate anomalies.

Install command:
`pip install fastapi uvicorn psycopg2-binary numpy python-dotenv scipy`

Start command:
`uvicorn main:app --port 8003 --reload`

Environment variables:
- `JWT_SECRET` (optional for cross-service consistency)

Endpoints:
- `POST /analyze` — Analyze recent earnings payload and return anomalies, risk score, and summary
