import os
from typing import Optional

import psycopg2
from dotenv import load_dotenv
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from psycopg2.extras import RealDictCursor

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

app = FastAPI(title="FairGig Analytics Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured")
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


@app.get("/analytics/commission-trends")
def commission_trends():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                  to_char(date_trunc('month', shift_date), 'YYYY-MM') AS month,
                  platform,
                  ROUND(AVG(platform_deductions / NULLIF(gross_earned, 0))::numeric, 4) AS avg_rate
                FROM earnings.shifts
                WHERE shift_date >= NOW() - INTERVAL '6 months'
                  AND gross_earned > 0
                GROUP BY month, platform
                ORDER BY month ASC, platform ASC
                """
            )
            return cur.fetchall()


@app.get("/analytics/income-distribution")
def income_distribution(zone: Optional[str] = Query(default=None)):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                WITH worker_income AS (
                  SELECT u.city_zone, SUM(s.net_received) AS total_income
                  FROM auth.users u
                  JOIN earnings.shifts s ON s.worker_id = u.id
                  WHERE u.role = 'worker'
                    AND (%s IS NULL OR u.city_zone = %s)
                    AND s.shift_date >= NOW() - INTERVAL '30 days'
                  GROUP BY u.id, u.city_zone
                )
                SELECT
                  city_zone AS zone,
                  COUNT(*) FILTER (WHERE total_income < 20000) AS bucket_0_20k,
                  COUNT(*) FILTER (WHERE total_income >= 20000 AND total_income < 40000) AS bucket_20_40k,
                  COUNT(*) FILTER (WHERE total_income >= 40000 AND total_income < 60000) AS bucket_40_60k,
                  COUNT(*) FILTER (WHERE total_income >= 60000) AS bucket_60k_plus
                FROM worker_income
                GROUP BY city_zone
                ORDER BY city_zone
                """,
                (zone, zone),
            )
            return cur.fetchall()


@app.get("/analytics/vulnerability-flags")
def vulnerability_flags():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                  u.id,
                  u.name,
                  u.city_zone,
                  u.category,
                  ROUND(SUM(CASE
                    WHEN date_trunc('month', s.shift_date) = date_trunc('month', NOW())
                    THEN s.net_received ELSE 0 END)::numeric, 2) AS current_month,
                  ROUND(SUM(CASE
                    WHEN date_trunc('month', s.shift_date) = date_trunc('month', NOW() - INTERVAL '1 month')
                    THEN s.net_received ELSE 0 END)::numeric, 2) AS previous_month
                FROM auth.users u
                JOIN earnings.shifts s ON s.worker_id = u.id
                WHERE u.role = 'worker'
                GROUP BY u.id, u.name, u.city_zone, u.category
                HAVING SUM(CASE
                    WHEN date_trunc('month', s.shift_date) = date_trunc('month', NOW() - INTERVAL '1 month')
                    THEN s.net_received ELSE 0 END) > 0
                   AND SUM(CASE
                    WHEN date_trunc('month', s.shift_date) = date_trunc('month', NOW())
                    THEN s.net_received ELSE 0 END)
                   < SUM(CASE
                    WHEN date_trunc('month', s.shift_date) = date_trunc('month', NOW() - INTERVAL '1 month')
                    THEN s.net_received ELSE 0 END) * 0.8
                ORDER BY current_month / NULLIF(previous_month, 0) ASC
                """
            )
            return cur.fetchall()


@app.get("/analytics/median/{category}/{zone}")
def median_hourly(category: str, zone: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                  PERCENTILE_CONT(0.5) WITHIN GROUP
                    (ORDER BY net_received / NULLIF(hours_worked, 0)) AS median_hourly
                FROM earnings.shifts s
                JOIN auth.users u ON u.id = s.worker_id
                WHERE u.city_zone = %s
                  AND u.category = %s
                  AND s.shift_date >= NOW() - INTERVAL '30 days'
                  AND s.verification_status = 'verified'
                  AND s.hours_worked > 0
                """,
                (zone, category),
            )
            row = cur.fetchone()
            return {"median_hourly": float(row["median_hourly"] or 0)}


@app.get("/analytics/top-complaints")
def top_complaints():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                  category,
                  COUNT(*)::int AS count
                FROM grievance.complaints
                WHERE created_at >= NOW() - INTERVAL '7 days'
                GROUP BY category
                ORDER BY count DESC
                LIMIT 10
                """
            )
            return cur.fetchall()
