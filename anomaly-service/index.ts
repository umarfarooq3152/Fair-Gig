import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 8003;

app.use(cors());
app.use(express.json());

function calculateStats(rates: number[]) {
  if (rates.length === 0) return { mean: 0, std: 0 };
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  const std = Math.sqrt(rates.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / rates.length);
  return { mean, std };
}

app.post('/analyze', (req, res) => {
  const { earnings } = req.body;
  const anomalies: any[] = [];
  
  if (!earnings || earnings.length < 3) {
    return res.json({ anomalies: [], risk_score: 0, summary: "Insufficient data for analysis" });
  }

  const rates = earnings.map((e: any) => e.platform_deductions / e.gross_earned).filter((r: number) => !isNaN(r));
  const { mean, std } = calculateStats(rates);

  earnings.forEach((e: any) => {
    const rate = e.platform_deductions / e.gross_earned;
    if (rate > mean + 2 * std) {
      anomalies.push({
        type: 'deduction_spike',
        severity: rate > mean + 3 * std ? 'high' : 'medium',
        affected_shift: e.shift_date,
        explanation: `Deduction ${Math.round(rate * 100)}% vs your avg ${Math.round(mean * 100)}%`
      });
    }
  });

  res.json({
    anomalies,
    risk_score: anomalies.length > 0 ? 75 : 10,
    summary: `${anomalies.length} anomaly detected. ${anomalies.length > 0 ? 'Possible irregularity.' : 'System healthy.'}`
  });
});

app.listen(PORT, () => {
  console.log(`Anomaly Service running on port ${PORT}`);
});
