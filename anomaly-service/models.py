from pydantic import BaseModel, field_validator
from typing import List
from datetime import date

class ShiftInput(BaseModel):
    shift_date: date
    platform: str
    gross_earned: float
    platform_deductions: float
    net_received: float
    hours_worked: float

    @field_validator('gross_earned','platform_deductions','net_received','hours_worked')
    @classmethod
    def must_be_non_negative(cls, v):
        if v < 0:
            raise ValueError('must be >= 0')
        return v

class AnalyzeRequest(BaseModel):
    worker_id: str
    earnings: List[ShiftInput] = []

class Anomaly(BaseModel):
    type: str
    severity: str
    affected_date: str
    platform: str
    explanation: str

class AnalyzeResponse(BaseModel):
    worker_id: str
    total_shifts_analyzed: int
    anomalies: List[Anomaly]
    risk_score: int
    summary: str
