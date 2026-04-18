from models import Anomaly
from typing import List

def calculate_risk_score(anomalies: List[Anomaly]) -> int:
    weights = {'high': 35, 'medium': 20, 'low': 10}
    return min(sum(weights.get(a.severity, 10) for a in anomalies), 100)

def generate_summary(anomalies: List[Anomaly], risk_score: int, total_shifts: int) -> str:
    if total_shifts == 0:
        return 'No earnings data provided.'
    if total_shifts < 3:
        return 'Insufficient data - need at least 3 shifts for analysis.'
    if not anomalies:
        return 'No anomalies detected. Your earnings appear consistent.'
    n = len(anomalies)
    if risk_score >= 70:
        return f'{n} anomaly(s) detected. High risk - possible platform irregularity.'
    if risk_score >= 40:
        return f'{n} anomaly(s) detected. Moderate concern - review flagged shifts.'
    return f'{n} anomaly(s) detected. Low risk - minor fluctuations noted.'
