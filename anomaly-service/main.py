from collections import defaultdict
from datetime import date, datetime
from typing import Any
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models import AnalyzeRequest, AnalyzeResponse
from detector import check_deduction_spike, check_income_drop, check_hourly_rate
from utils import calculate_risk_score, generate_summary
import os
import psycopg2
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

def get_conn():
    if not DATABASE_URL:
        return None
    return psycopg2.connect(DATABASE_URL)
app = FastAPI(
    title="FairGig Anomaly Detection Service",
    description="Detects unusual deductions and income drops. Judges: see /docs for interactive testing.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*']
)

@app.get('/health')
def health():
    return {'status': 'ok', 'service': 'anomaly-service', 'port': 8003}

@app.post('/analyze', response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest):
    earnings = request.earnings
    anomalies = []
    # Only run detectors if at least 3 shifts, else skip (edge case handled in summary)
    if earnings and len(earnings) >= 3:
        anomalies += check_deduction_spike(earnings)
        anomalies += check_income_drop(earnings)
        anomalies += check_hourly_rate(earnings)
    risk_score = calculate_risk_score(anomalies)
    summary = generate_summary(anomalies, risk_score, len(earnings))
    
    if anomalies and DATABASE_URL:
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    for a in anomalies:
                        cur.execute(
                            """
                            INSERT INTO analytics.anomaly_logs 
                            (worker_id, anomaly_type, severity, affected_date, platform, explanation, risk_score)
                            VALUES (%s, %s::analytics.anomaly_type, %s::analytics.anomaly_severity, %s, %s, %s, %s)
                            """,
                            (request.worker_id, a.type, a.severity, a.affected_date, a.platform or 'Other', a.explanation, risk_score)
                        )
        except Exception as e:
            print(f"Failed to persist anomalies to DB: {e}")
    return AnalyzeResponse(
        worker_id=request.worker_id,
        total_shifts_analyzed=len(earnings),
        anomalies=anomalies,
        risk_score=risk_score,
        summary=summary
    )
