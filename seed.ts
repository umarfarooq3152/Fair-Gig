import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
});

const platforms: Record<string, [number, number]> = {
  Careem: [0.25, 0.3],
  Bykea: [0.18, 0.22],
  foodpanda: [0.28, 0.35],
  Upwork: [0.1, 0.2],
};

const cityZones = ['Gulberg', 'DHA', 'Saddar', 'Johar Town', 'Cantt'];
const categories = ['ride_hailing', 'food_delivery', 'freelance', 'domestic'];

const zoneMultiplier: Record<string, number> = {
  Gulberg: 1.08,
  DHA: 1.15,
  Saddar: 0.95,
  'Johar Town': 1.02,
  Cantt: 1.06,
};

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function sample<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

function toMoney(value: number) {
  return Math.round(value * 100) / 100;
}

async function seed() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const client = await pool.connect();

  console.log('Applying schema.sql...');
  const schemaSql = await import('fs/promises').then((fs) => fs.readFile('./schema.sql', 'utf-8'));
  await client.query(schemaSql);

  console.log('Clearing existing seeded data...');
  await client.query('DELETE FROM grievance.complaints');
  await client.query('DELETE FROM earnings.shifts');
  await client.query('DELETE FROM auth.users');

  const passwordHash = await bcrypt.hash('password', 10);

  console.log('Seeding 60 workers...');
  const workerIds: string[] = [];
  for (let i = 1; i <= 60; i++) {
    const zone = sample(cityZones);
    const category = sample(categories);
    const userResult = await client.query(
      `INSERT INTO auth.users (name, email, password_hash, role, city_zone, category)
       VALUES ($1, $2, $3, 'worker', $4, $5)
       RETURNING id`,
      [`Worker ${i}`, `worker${i}@fairgig.demo`, passwordHash, zone, category],
    );
    const workerId = userResult.rows[0].id as string;
    workerIds.push(workerId);

    const totalShifts = randomInt(90, 180);
    const spikeIndices = new Set<number>();
    while (spikeIndices.size < randomInt(5, 8)) {
      spikeIndices.add(randomInt(0, totalShifts - 1));
    }

    for (let j = 0; j < totalShifts; j++) {
      const platformName = sample(Object.keys(platforms));
      const [minDeduction, maxDeduction] = platforms[platformName];
      const date = new Date();
      date.setDate(date.getDate() - randomInt(0, 180));
      const shiftDate = date.toISOString().split('T')[0];

      const hours = toMoney(randomFloat(4, 11));
      const baseHourly = randomFloat(260, 520) * zoneMultiplier[zone];
      const gross = toMoney(hours * baseHourly);

      let deductionRate = randomFloat(minDeduction, maxDeduction);
      if (spikeIndices.has(j)) {
        deductionRate += randomFloat(0.08, 0.17);
      }
      deductionRate = Math.min(deductionRate, 0.55);

      const deductions = toMoney(gross * deductionRate);
      const net = toMoney(gross - deductions);
      const verificationStatus = Math.random() < 0.8 ? 'verified' : 'pending';

      await client.query(
        `INSERT INTO earnings.shifts
        (worker_id, platform, shift_date, hours_worked, gross_earned, platform_deductions, net_received, verification_status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [workerId, platformName, shiftDate, hours, gross, deductions, net, verificationStatus],
      );
    }
  }

  await client.query(
    `INSERT INTO auth.users (name, email, password_hash, role, city_zone, category)
     VALUES
     ('Verifier Ali', 'verifier@fairgig.demo', $1, 'verifier', 'DHA', 'ride_hailing'),
     ('Advocate Fatima', 'advocate@fairgig.demo', $1, 'advocate', 'Gulberg', 'food_delivery')`,
    [passwordHash],
  );

  for (let i = 0; i < 25; i++) {
    const workerId = sample(workerIds);
    await client.query(
      `INSERT INTO grievance.complaints (worker_id, platform, category, description, tags, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        workerId,
        sample(['Careem', 'Bykea', 'foodpanda', 'Upwork']),
        sample(['commission_hike', 'payment_delay', 'account_deactivation', 'incentive_mismatch']),
        'Platform deductions looked inconsistent with expected commission for this week.',
        ['commission', 'income-drop'],
        sample(['open', 'escalated', 'resolved']),
      ],
    );
  }

  const countResult = await client.query('SELECT COUNT(*)::int as count FROM earnings.shifts');
  console.log(`Seed successful. Inserted ${countResult.rows[0].count} shifts.`);

  client.release();
  await pool.end();
}

seed().catch(console.error);
