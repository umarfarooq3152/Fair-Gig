import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const app = express();
const PORT = 8003;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
});

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateStats(rates: number[]) {
  if (rates.length === 0) return { mean: 0, std: 0 };
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  const std = Math.sqrt(rates.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / rates.length);
  return { mean, std };
}

// ---------------------------------------------------------------------------
// POST /analyze — detect anomalies and persist to analytics.anomaly_logs
// ---------------------------------------------------------------------------
app.post('/analyze', async (req, res) => {
  const { worker_id, earnings } = req.body;
  const anomalies: any[] = [];

  if (!earnings || earnings.length < 3) {
    return res.json({
      anomalies: [],
      risk_score: 0,
      summary: 'Insufficient data for analysis',
    });
  }

  // --- Deduction Spike Detection (per-platform) ---
  const byPlatform: Record<string, any[]> = {};
  for (const e of earnings) {
    if (!byPlatform[e.platform]) byPlatform[e.platform] = [];
    byPlatform[e.platform].push(e);
  }

  for (const [platform, entries] of Object.entries(byPlatform)) {
    const rates = entries
      .filter((e: any) => e.gross_earned > 0)
      .map((e: any) => e.platform_deductions / e.gross_earned);

    if (rates.length < 3) continue;

    const { mean, std } = calculateStats(rates);
    const threshold = mean + 2 * std;

    for (const e of entries) {
      if (e.gross_earned <= 0) continue;
      const rate = e.platform_deductions / e.gross_earned;
      if (rate > threshold) {
        anomalies.push({
          type: 'deduction_spike',
          severity: rate > mean + 3 * std ? 'high' : 'medium',
          affected_date: e.shift_date,
          platform,
          explanation: `Deduction ${Math.round(rate * 100)}% vs your avg ${Math.round(mean * 100)}% on ${platform}`,
        });
      }
    }
  }

  // --- Income Drop Detection (MoM) ---
  const monthlyTotals: Record<string, number> = {};
  for (const e of earnings) {
    const m = String(e.shift_date).substring(0, 7); // YYYY-MM
    monthlyTotals[m] = (monthlyTotals[m] || 0) + Number(e.net_received);
  }

  const months = Object.keys(monthlyTotals).sort();
  if (months.length >= 2) {
    const prev = monthlyTotals[months[months.length - 2]];
    const curr = monthlyTotals[months[months.length - 1]];
    if (prev > 0 && curr < prev * 0.8) {
      const dropPct = Math.round((1 - curr / prev) * 100);
      anomalies.push({
        type: 'income_drop',
        severity: dropPct > 35 ? 'high' : 'medium',
        affected_date: months[months.length - 1],
        platform: 'all',
        explanation: `Monthly net income dropped ${dropPct}% from ${months[months.length - 2]} to ${months[months.length - 1]}`,
      });
    }
  }

  // --- Hourly Rate Drop Detection ---
  const sorted = [...earnings].sort((a: any, b: any) =>
    String(a.shift_date).localeCompare(String(b.shift_date)),
  );
  const latest = sorted[sorted.length - 1];
  if (latest.hours_worked > 0) {
    const latestRate = latest.net_received / latest.hours_worked;
    const baseline = sorted.slice(0, -1).filter((e: any) => e.hours_worked > 0);
    if (baseline.length >= 2) {
      const baselineRates = baseline.map((e: any) => e.net_received / e.hours_worked);
      const avgBaseline = baselineRates.reduce((a: number, b: number) => a + b, 0) / baselineRates.length;
      if (avgBaseline > 0 && latestRate < avgBaseline * 0.7) {
        anomalies.push({
          type: 'hourly_rate_drop',
          severity: 'medium',
          affected_date: String(latest.shift_date),
          platform: latest.platform || 'all',
          explanation: `Hourly net rate Rs.${Math.round(latestRate)}/hr vs your avg Rs.${Math.round(avgBaseline)}/hr`,
        });
      }
    }
  }

  // --- Risk Score ---
  const severityPoints: Record<string, number> = { low: 10, medium: 20, high: 35 };
  const rawScore = anomalies.reduce((sum, a) => sum + (severityPoints[a.severity] || 10), 0);
  const risk_score = Math.max(0, Math.min(100, rawScore));

  // --- Persist anomalies to analytics.anomaly_logs ---
  if (worker_id && anomalies.length > 0) {
    try {
      for (const a of anomalies) {
        await pool.query(
          `INSERT INTO analytics.anomaly_logs
           (worker_id, anomaly_type, severity, affected_date, platform, explanation, risk_score)
           VALUES ($1, $2::analytics.anomaly_type, $3::analytics.anomaly_severity, $4, $5, $6, $7)`,
          [worker_id, a.type, a.severity, a.affected_date, a.platform, a.explanation, risk_score],
        );
      }
    } catch (err: any) {
      console.error('Failed to persist anomaly logs:', err.message);
    }
  }

  res.json({
    anomalies,
    risk_score,
    summary: anomalies.length > 0
      ? `${anomalies.length} anomaly detected. Signals: ${[...new Set(anomalies.map(a => a.type))].join(', ')}.`
      : 'No anomalies detected. Earnings pattern looks stable.',
  });
});

// ---------------------------------------------------------------------------
// GET /anomalies/:worker_id — retrieve anomaly history from DB
// ---------------------------------------------------------------------------
app.get('/anomalies/:worker_id', async (req, res) => {
  const { worker_id } = req.params;

  const result = await pool.query(
    `SELECT * FROM analytics.anomaly_logs
     WHERE worker_id = $1
     ORDER BY detected_at DESC
     LIMIT 50`,
    [worker_id],
  );

  res.json(result.rows);
});

app.listen(PORT, () => {
  console.log(`Anomaly Service running on port ${PORT}`);
});
