import os
from pathlib import Path
from typing import Any, Optional

import psycopg2
from dotenv import load_dotenv
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from psycopg2.extras import RealDictCursor

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
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


@app.get("/health")
def health():
    return {"status": "ok", "service": "analytics-service", "port": 8005}


@app.get("/analytics/advocate-summary")
def advocate_summary():
    """KPI strip for the advocate dashboard — single round-trip from live DB."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*)::int AS total_workers
                FROM auth.users
                WHERE role = 'worker'
                """
            )
            total_workers = int(cur.fetchone()["total_workers"] or 0)

            cur.execute(
                """
                SELECT
                  COUNT(*) FILTER (
                    WHERE created_at >= date_trunc('month', NOW())
                  )::int AS new_this_month,
                  COUNT(*) FILTER (
                    WHERE created_at >= date_trunc('month', NOW() - INTERVAL '1 month')
                      AND created_at < date_trunc('month', NOW())
                  )::int AS new_last_month
                FROM auth.users
                WHERE role = 'worker'
                """
            )
            row_reg = cur.fetchone()
            new_this = int(row_reg["new_this_month"] or 0)
            new_last = int(row_reg["new_last_month"] or 0)
            if new_last > 0:
                registration_mom_pct = round((new_this - new_last) / new_last * 100, 1)
            elif new_this > 0:
                registration_mom_pct = 100.0
            else:
                registration_mom_pct = 0.0

            cur.execute(
                """
                SELECT
                  ROUND((
                    SELECT SUM(platform_deductions) / NULLIF(SUM(gross_earned), 0)
                    FROM earnings.shifts
                    WHERE gross_earned > 0
                      AND date_trunc('month', shift_date) = date_trunc('month', NOW())
                  )::numeric, 4) AS avg_commission_this_month,
                  ROUND((
                    SELECT SUM(platform_deductions) / NULLIF(SUM(gross_earned), 0)
                    FROM earnings.shifts
                    WHERE gross_earned > 0
                      AND date_trunc('month', shift_date) = date_trunc('month', NOW() - INTERVAL '1 month')
                  )::numeric, 4) AS avg_commission_last_month
                """
            )
            row_c = cur.fetchone()
            c_this = float(row_c["avg_commission_this_month"] or 0)
            c_last = float(row_c["avg_commission_last_month"] or 0)
            if c_last > 0:
                commission_mom_delta_pp = round((c_this - c_last) * 100, 2)
            else:
                commission_mom_delta_pp = 0.0

            cur.execute(
                """
                SELECT
                  COUNT(*) FILTER (WHERE status IN ('open', 'escalated'))::int AS active_complaints,
                  COUNT(*) FILTER (WHERE status = 'escalated')::int AS escalated_complaints
                FROM grievance.complaints
                """
            )
            row_g = cur.fetchone()
            active_complaints = int(row_g["active_complaints"] or 0)
            escalated_complaints = int(row_g["escalated_complaints"] or 0)

            cur.execute(
                """
                SELECT COUNT(*)::int AS n
                FROM (
                  SELECT u.id
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
                ) flagged
                """
            )
            vulnerability_count = int(cur.fetchone()["n"] or 0)

    return {
        "total_workers": total_workers,
        "new_workers_this_month": new_this,
        "new_workers_last_month": new_last,
        "registration_mom_pct": registration_mom_pct,
        "avg_commission_rate": round(c_this * 100, 2),
        "avg_commission_rate_prev_month_pct": round(c_last * 100, 2),
        "commission_mom_delta_pp": commission_mom_delta_pp,
        "active_complaints": active_complaints,
        "escalated_complaints": escalated_complaints,
        "vulnerability_count": vulnerability_count,
    }


@app.get("/analytics/income-by-zone-category")
def income_by_zone_category():
    """Net income (PKR) in the last 30 days, grouped by worker city zone and gig category."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                  u.city_zone AS zone,
                  u.category::text AS category,
                  ROUND(COALESCE(SUM(s.net_received), 0)::numeric, 0) AS total_net
                FROM auth.users u
                JOIN earnings.shifts s ON s.worker_id = u.id
                WHERE u.role = 'worker'
                  AND s.shift_date >= NOW() - INTERVAL '30 days'
                GROUP BY u.city_zone, u.category
                ORDER BY u.city_zone, u.category
                """
            )
            rows = cur.fetchall()
    return [dict(r) for r in rows]


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
            zones = cur.fetchall()
    histogram: list[dict[str, Any]] = []
    bucket_meta = [
        ("0–20k PKR", "bucket_0_20k"),
        ("20–40k PKR", "bucket_20_40k"),
        ("40–60k PKR", "bucket_40_60k"),
        ("60k+ PKR", "bucket_60k_plus"),
    ]
    for row in zones:
        z = row["zone"]
        for label, key in bucket_meta:
            histogram.append(
                {
                    "zone": z,
                    "bucket_range": label,
                    "worker_count": int(row[key] or 0),
                }
            )
    return {"zones": zones, "histogram": histogram}


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
                    THEN s.net_received ELSE 0 END)::numeric, 2) AS previous_month,
                  ROUND((
                    1 - (
                      SUM(CASE
                        WHEN date_trunc('month', s.shift_date) = date_trunc('month', NOW())
                        THEN s.net_received ELSE 0 END)
                      / NULLIF(SUM(CASE
                        WHEN date_trunc('month', s.shift_date) = date_trunc('month', NOW() - INTERVAL '1 month')
                        THEN s.net_received ELSE 0 END), 0)
                    )
                  ) * 100, 1) AS drop_percentage
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
                    (ORDER BY net_received / NULLIF(hours_worked, 0)) AS median_hourly,
                  COUNT(*)::int AS sample_size
                FROM earnings.shifts s
                JOIN auth.users u ON u.id = s.worker_id
                WHERE u.city_zone::text = %s
                  AND u.category::text = %s
                  AND s.shift_date >= NOW() - INTERVAL '30 days'
                  AND s.verification_status = 'verified'
                  AND s.hours_worked > 0
                """,
                (zone, category),
            )
            row = cur.fetchone()
            med = float(row["median_hourly"] or 0)
            n = int(row["sample_size"] or 0)
            return {
                "median_hourly_rate": med,
                "median_hourly": med,
                "sample_size": n,
                "category": category,
                "zone": zone,
            }


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
