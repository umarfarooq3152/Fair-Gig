from collections import defaultdict
from datetime import date, datetime
from typing import Any

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="FairGig Anomaly Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class EarningRecord(BaseModel):
    shift_date: date
    platform: str
    gross_earned: float = Field(ge=0)
    platform_deductions: float = Field(ge=0)
    net_received: float = Field(ge=0)
    hours_worked: float = Field(ge=0)


class AnalyzeRequest(BaseModel):
    worker_id: str
    earnings: list[EarningRecord] = Field(default_factory=list, example=[
        {
            "shift_date": "2025-01-15",
            "platform": "Careem",
            "gross_earned": 2000,
            "platform_deductions": 700,
            "net_received": 1300,
            "hours_worked": 4,
        }
    ])


def detect_deduction_spike(earnings: list[EarningRecord]) -> list[dict[str, Any]]:
    anomalies: list[dict[str, Any]] = []
    if len(earnings) < 3:
        return anomalies

    by_platform: dict[str, list[EarningRecord]] = defaultdict(list)
    for e in earnings:
        by_platform[e.platform].append(e)

    for platform, entries in by_platform.items():
        rates = [
            e.platform_deductions / e.gross_earned
            for e in entries
            if e.gross_earned > 0
        ]
        if len(rates) < 3:
            continue

        mean = float(np.mean(rates))
        std = float(np.std(rates))
        threshold = mean + (2 * std)

        for e in entries:
            if e.gross_earned <= 0:
                continue
            rate = e.platform_deductions / e.gross_earned
            if rate > threshold:
                anomalies.append(
                    {
                        "type": "deduction_spike",
                        "severity": "high" if rate > mean + 3 * std else "medium",
                        "affected_shift": str(e.shift_date),
                        "explanation": f"Your deduction ({rate:.0%}) is unusually high vs your 3-month average ({mean:.0%}) on {platform}.",
                    }
                )

    return anomalies


def detect_income_drop(earnings: list[EarningRecord]) -> list[dict[str, Any]]:
    anomalies: list[dict[str, Any]] = []
    if len(earnings) < 3:
        return anomalies

    monthly_totals: dict[str, float] = defaultdict(float)
    for e in earnings:
        monthly_totals[e.shift_date.strftime("%Y-%m")] += e.net_received

    months = sorted(monthly_totals.keys())
    if len(months) < 2:
        return anomalies

    prev_month = months[-2]
    current_month = months[-1]
    previous = monthly_totals[prev_month]
    current = monthly_totals[current_month]

    if previous > 0 and current < previous * 0.8:
        drop_pct = (1 - (current / previous)) * 100
        anomalies.append(
            {
                "type": "income_drop",
                "severity": "high" if drop_pct > 35 else "medium",
                "affected_shift": current_month,
                "explanation": f"Monthly net income dropped {drop_pct:.0f}% from {prev_month} to {current_month}.",
            }
        )

    return anomalies


def detect_hourly_rate_drop(earnings: list[EarningRecord]) -> list[dict[str, Any]]:
    anomalies: list[dict[str, Any]] = []
    if len(earnings) < 3:
        return anomalies

    sorted_records = sorted(earnings, key=lambda x: x.shift_date)
    latest = sorted_records[-1]

    if latest.hours_worked <= 0:
        return anomalies

    latest_rate = latest.net_received / latest.hours_worked
    baseline_window = sorted_records[-30:] if len(sorted_records) > 30 else sorted_records[:-1]
    baseline_rates = [
        r.net_received / r.hours_worked
        for r in baseline_window
        if r.hours_worked > 0
    ]

    if len(baseline_rates) < 2:
        return anomalies

    baseline_avg = float(np.mean(baseline_rates))
    if baseline_avg > 0 and latest_rate < baseline_avg * 0.7:
        anomalies.append(
            {
                "type": "hourly_rate_drop",
                "severity": "medium",
                "affected_shift": str(latest.shift_date),
                "explanation": f"Hourly net rate dropped to Rs.{latest_rate:.0f}/hr vs your 30-day average Rs.{baseline_avg:.0f}/hr.",
            }
        )

    return anomalies


def build_summary(anomaly_count: int, anomalies: list[dict[str, Any]]) -> str:
    if anomaly_count == 0:
        return "No anomalies detected. Earnings pattern looks stable."

    labels = sorted({a["type"] for a in anomalies})
    return f"{anomaly_count} anomaly detected. Signals: {', '.join(labels)}."


@app.post("/analyze")
def analyze(payload: AnalyzeRequest):
    earnings = payload.earnings or []

    if len(earnings) < 3:
        return {
            "anomalies": [],
            "risk_score": 0,
            "summary": "Insufficient data for anomaly checks.",
        }

    anomalies: list[dict[str, Any]] = []
    anomalies.extend(detect_deduction_spike(earnings))
    anomalies.extend(detect_income_drop(earnings))
    anomalies.extend(detect_hourly_rate_drop(earnings))

    severity_points = {"low": 10, "medium": 20, "high": 35}
    raw_score = sum(severity_points.get(a.get("severity", "low"), 10) for a in anomalies)
    risk_score = max(0, min(100, raw_score))

    return {
        "anomalies": anomalies,
        "risk_score": risk_score,
        "summary": build_summary(len(anomalies), anomalies),
    }
