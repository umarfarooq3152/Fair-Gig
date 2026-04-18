import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
});

const platforms = ['Careem', 'Bykea', 'foodpanda', 'Upwork'] as const;
const platformDeductions: Record<string, [number, number]> = {
  Careem: [0.25, 0.3],
  Bykea: [0.18, 0.22],
  foodpanda: [0.28, 0.35],
  Upwork: [0.1, 0.2],
};

const cityZones = ['Gulberg', 'DHA', 'Saddar', 'Johar Town', 'Cantt'] as const;
const categories = ['ride_hailing', 'food_delivery', 'freelance', 'domestic'] as const;

const zoneMultiplier: Record<string, number> = {
  Gulberg: 1.08,
  DHA: 1.15,
  Saddar: 0.95,
  'Johar Town': 1.02,
  Cantt: 1.06,
};

const complaintCategories = [
  'commission_hike', 'account_deactivation', 'payment_delay',
  'unfair_rating', 'data_privacy', 'other',
] as const;

const postTypes = ['rate_intel', 'complaint', 'support', 'general'] as const;

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function sample<T>(arr: readonly T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

function toMoney(value: number) {
  return Math.round(value * 100) / 100;
}

async function seed() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required — set it in .env');
  }

  const client = await pool.connect();

  // Note: neon_database.sql should have been run separately on Neon.
  // This seed script only inserts data — schema is already applied.

  console.log('Clearing existing seeded data...');
  await client.query('DELETE FROM community.post_moderations');
  await client.query('DELETE FROM community.posts');
  await client.query('DELETE FROM grievance.complaint_upvotes');
  await client.query('DELETE FROM grievance.complaint_history');
  await client.query('DELETE FROM grievance.complaints');
  await client.query('DELETE FROM grievance.complaint_clusters');
  await client.query('DELETE FROM analytics.anomaly_logs');
  await client.query('DELETE FROM earnings.shift_screenshots');
  await client.query('DELETE FROM earnings.verification_history');
  await client.query('DELETE FROM earnings.csv_imports');
  await client.query('DELETE FROM earnings.shifts');
  await client.query('DELETE FROM auth.refresh_tokens');
  await client.query('DELETE FROM auth.users');

  const passwordHash = await bcrypt.hash('password', 10);

  // ---------------------------------------------------------------------------
  // Seed 60 workers
  // ---------------------------------------------------------------------------
  console.log('Seeding 60 workers...');
  const workerIds: string[] = [];

  for (let i = 1; i <= 60; i++) {
    const zone = sample(cityZones);
    const category = sample(categories);

    const userResult = await client.query(
      `INSERT INTO auth.users (name, email, password_hash, role, city_zone, category, phone)
       VALUES ($1, $2, $3, 'worker'::auth.user_role, $4::auth.city_zone, $5::auth.worker_category, $6)
       RETURNING id`,
      [
        `Worker ${i}`,
        `worker${i}@fairgig.demo`,
        passwordHash,
        zone,
        category,
        `+92-${300 + randomInt(0, 99)}-${randomInt(1000000, 9999999)}`,
      ],
    );
    const workerId = userResult.rows[0].id as string;
    workerIds.push(workerId);

    // Generate 90–180 shifts per worker
    const totalShifts = randomInt(90, 180);
    const spikeIndices = new Set<number>();
    while (spikeIndices.size < randomInt(5, 8)) {
      spikeIndices.add(randomInt(0, totalShifts - 1));
    }

    for (let j = 0; j < totalShifts; j++) {
      const platformName = sample(platforms);
      const [minDeduction, maxDeduction] = platformDeductions[platformName];
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
         (worker_id, platform, shift_date, hours_worked,
          gross_earned, platform_deductions, net_received, verification_status)
         VALUES ($1, $2::earnings.platform_name, $3, $4, $5, $6, $7, $8::earnings.verify_status)`,
        [workerId, platformName, shiftDate, hours, gross, deductions, net, verificationStatus],
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Seed verifier + advocate
  // ---------------------------------------------------------------------------
  console.log('Seeding verifier and advocate...');
  await client.query(
    `INSERT INTO auth.users (name, email, password_hash, role)
     VALUES
       ('Verifier Ali', 'verifier@fairgig.demo', $1, 'verifier'::auth.user_role),
       ('Advocate Fatima', 'advocate@fairgig.demo', $1, 'advocate'::auth.user_role)`,
    [passwordHash],
  );

  // ---------------------------------------------------------------------------
  // Seed 25 complaints with valid categories
  // ---------------------------------------------------------------------------
  console.log('Seeding 25 complaints...');
  const complaintDescriptions = [
    'Platform deductions looked very inconsistent with expected commission rates for this week and I was charged more than usual.',
    'My account was deactivated without any explanation or prior warning from the platform team and process was opaque.',
    'Payment was delayed by over 5 days this month and the platform has not responded to my support ticket at all.',
    'I received an unfair rating from a customer but the platform refused to review or remove the rating despite evidence.',
    'I believe the platform is collecting and sharing my location data without proper consent or transparency about usage.',
    'The commission rate was increased from 25% to 30% overnight — no notification, no explanation, no option to contest.',
  ];

  for (let i = 0; i < 25; i++) {
    const workerId = sample(workerIds);
    await client.query(
      `INSERT INTO grievance.complaints
       (worker_id, platform, category, description, tags, status, is_anonymous)
       VALUES ($1, $2, $3::grievance.complaint_category, $4, $5, $6::grievance.complaint_status, $7)`,
      [
        workerId,
        sample([...platforms]),
        sample([...complaintCategories]),
        sample(complaintDescriptions),
        ['commission', 'income-drop'],
        sample(['open', 'escalated', 'resolved']),
        Math.random() < 0.3,
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // Seed 10 community posts
  // ---------------------------------------------------------------------------
  console.log('Seeding 10 community posts...');
  const postData = [
    { type: 'rate_intel', platform: 'Careem', title: 'Careem commission jumped in DHA', body: 'Watch out — Careem is taking 30% now in DHA area. Was 25% last week. Anyone else seeing this? Post your numbers below.' },
    { type: 'rate_intel', platform: 'Bykea', title: 'Bykea rates stable in Gulberg', body: 'Good news for Gulberg riders — Bykea deductions are still at 19%. Make sure to keep records in case they change.' },
    { type: 'complaint', platform: 'foodpanda', title: 'Foodpanda late payments again', body: 'Three weeks running and foodpanda is paying late. Anyone else? We should escalate this collectively if many are affected.' },
    { type: 'support', platform: null, title: 'How to file a grievance properly', body: 'For new workers: go to the Grievance Board, click "New Complaint", select the right category, and be very specific in your description.' },
    { type: 'general', platform: null, title: 'FairGig tips for new riders', body: 'If you are new, always screenshot your earnings at the end of every shift. This makes the verification process faster and smoother.' },
    { type: 'rate_intel', platform: 'Upwork', title: 'Upwork fee structure has changed', body: 'Upwork now charges 10% flat instead of tiered. If you have longstanding clients you should renegotiate your rates accordingly.' },
    { type: 'complaint', platform: 'Careem', title: 'Unfair deactivation in Cantt', body: 'Three drivers in Cantt area got deactivated this week without any warning. If you were affected, please file a formal grievance.' },
    { type: 'support', platform: null, title: 'Understanding your income cert', body: 'The income certificate on FairGig only includes verified shifts, so make sure all your data is verified before generating one.' },
    { type: 'general', platform: 'Bykea', title: 'Bykea bonus program is back', body: 'Bykea is offering bonuses for 50+ rides per week again. DHA and Gulberg zones qualify. Check the Bykea app for details.' },
    { type: 'rate_intel', platform: 'foodpanda', title: 'Foodpanda deductions creeping up', body: 'Noticed foodpanda deductions went from 30% to 33% in Saddar this week. Keep your screenshots to track this.' },
  ];

  for (const p of postData) {
    await client.query(
      `INSERT INTO community.posts (post_type, platform, title, body, worker_id)
       VALUES ($1::community.post_type, $2, $3, $4, $5)`,
      [p.type, p.platform, p.title, p.body, Math.random() < 0.5 ? sample(workerIds) : null],
    );
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  const countResult = await client.query('SELECT COUNT(*)::int AS count FROM earnings.shifts');
  const userCount = await client.query("SELECT COUNT(*)::int AS count FROM auth.users WHERE role = 'worker'");
  const complaintCount = await client.query('SELECT COUNT(*)::int AS count FROM grievance.complaints');
  const postCount = await client.query('SELECT COUNT(*)::int AS count FROM community.posts');

  console.log(`\n✅ Seed successful!`);
  console.log(`   Workers:    ${userCount.rows[0].count}`);
  console.log(`   Shifts:     ${countResult.rows[0].count}`);
  console.log(`   Complaints: ${complaintCount.rows[0].count}`);
  console.log(`   Posts:       ${postCount.rows[0].count}`);

  client.release();
  await pool.end();
}

seed().catch(console.error);
