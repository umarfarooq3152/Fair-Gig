import express from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import cors from 'cors';

const app = express();
const PORT = 8005;

app.use(cors());
app.use(express.json());

async function getDb() {
  return open({
    filename: './fairgig.db',
    driver: sqlite3.Database
  });
}

// GET /analytics/median/:category/:zone
app.get('/analytics/median/:category/:zone', async (req, res) => {
  const { category, zone } = req.params;
  const db = await getDb();
  
  const rates = await db.all(`
    SELECT s.net_received / s.hours_worked as hourly
    FROM shifts s
    JOIN users u ON u.id = s.worker_id
    WHERE u.city_zone = ? AND u.category = ? AND s.verification_status = 'verified'
    AND s.shift_date >= date('now', '-30 days')
  `, [zone, category]);

  if (rates.length === 0) return res.json({ median_hourly: 250 });
  
  const sorted = rates.map(r => r.hourly).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  
  res.json({ median_hourly: Math.round(median) });
});

// GET /analytics/income-distribution
app.get('/analytics/income-distribution', async (req, res) => {
  const db = await getDb();
  const workerStats = await db.all(`
    SELECT u.city_zone, SUM(s.net_received) as total_income
    FROM users u
    JOIN shifts s ON u.id = s.worker_id
    WHERE s.verification_status = 'verified'
    GROUP BY u.id, u.city_zone
  `);

  const zones = [...new Set(workerStats.map(w => w.city_zone))];
  const distribution = zones.map(zone => {
    const stats = workerStats.filter(w => w.city_zone === zone);
    return {
      zone,
      '<20k': stats.filter(s => s.total_income < 20000).length,
      '20k-40k': stats.filter(s => s.total_income >= 20000 && s.total_income < 40000).length,
      '40k-60k': stats.filter(s => s.total_income >= 40000 && s.total_income < 60000).length,
      '60k+': stats.filter(s => s.total_income >= 60000).length,
    };
  });

  res.json(distribution);
});

app.listen(PORT, () => {
  console.log(`Analytics Service running on port ${PORT}`);
});
