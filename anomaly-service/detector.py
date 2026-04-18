import numpy as np
from models import ShiftInput, Anomaly
from typing import List

def check_deduction_spike(earnings: List[ShiftInput]) -> List[Anomaly]:
    anomalies = []
    platforms = set(e.platform for e in earnings)
    for platform in platforms:
        shifts = [e for e in earnings if e.platform == platform and e.gross_earned > 0]
        if len(shifts) < 3:
            continue
        rates = [e.platform_deductions / e.gross_earned for e in shifts]
        mean, std = np.mean(rates), np.std(rates)
        if std == 0:
            continue
        for e in shifts:
            rate = e.platform_deductions / e.gross_earned
            z = (rate - mean) / std
            if z > 2.0:
                sev = 'high' if z > 3.0 else 'medium'
                anomalies.append(Anomaly(
                    type='deduction_spike', severity=sev,
                    affected_date=str(e.shift_date), platform=platform,
                    explanation=(
                        f'Your {platform} deduction on {e.shift_date} was '
                        f'{rate:.0%}, higher than your '
                        f'{len(shifts)}-shift average of {mean:.0%}. '
                        f'This could indicate a commission rate change '
                        f'or a calculation error by the platform.'
                    )))
    return anomalies

def check_income_drop(earnings: List[ShiftInput]) -> List[Anomaly]:
    anomalies = []
    if len(earnings) < 2:
        return []
    monthly = {}
    for e in earnings:
        key = (e.shift_date.year, e.shift_date.month)
        monthly[key] = monthly.get(key, 0) + e.net_received
    if len(monthly) < 2:
        return []
    sorted_months = sorted(monthly.keys())
    for i in range(1, len(sorted_months)):
        prev = monthly[sorted_months[i-1]]
        curr = monthly[sorted_months[i]]
        if prev == 0:
            continue
        drop = (prev - curr) / prev
        if drop > 0.20:
            sev = 'high' if drop > 0.40 else 'medium'
            yr, mo = sorted_months[i]
            anomalies.append(Anomaly(
                type='income_drop', severity=sev,
                affected_date=f'{yr}-{mo:02d}', platform='all',
                explanation=(
                    f'Your income in {yr}-{mo:02d} dropped by {drop:.0%} '
                    f'vs the previous month '
                    f'(Rs.{curr:.0f} vs Rs.{prev:.0f}). '
                    f'This may indicate fewer shifts, account restrictions, '
                    f'or a platform rate cut.'
                )))
    return anomalies

def check_hourly_rate(earnings: List[ShiftInput]) -> List[Anomaly]:
    anomalies = []
    valid = [e for e in earnings if e.hours_worked > 0 and e.net_received > 0]
    if len(valid) < 5:
        return []
    rates = [e.net_received / e.hours_worked for e in valid]
    mean, std = np.mean(rates), np.std(rates)
    if std == 0:
        return []
    for e in valid:
        rate = e.net_received / e.hours_worked
        z = (mean - rate) / std
        if z > 2.0:
            sev = 'high' if z > 3.0 else 'low'
            anomalies.append(Anomaly(
                type='hourly_rate_drop', severity=sev,
                affected_date=str(e.shift_date), platform=e.platform,
                explanation=(
                    f'On {e.shift_date}, your effective hourly rate on '
                    f'{e.platform} was Rs.{rate:.0f}/hr, well below '
                    f'your average of Rs.{mean:.0f}/hr. Long unpaid '
                    f'waiting time or unusually high deductions may be the cause.'
                )))
    return anomalies
