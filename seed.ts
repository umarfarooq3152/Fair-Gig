import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
});

// ---------------------------------------------------------------------------
// Constants matching neon_database.sql ENUMs exactly
// ---------------------------------------------------------------------------

const PLATFORMS = ['Careem', 'Bykea', 'foodpanda', 'Upwork', 'Other'] as const;
const PLATFORM_DEDUCTIONS: Record<string, [number, number]> = {
  Careem: [0.20, 0.32],
  Bykea: [0.15, 0.25],
  foodpanda: [0.25, 0.38],
  Upwork: [0.10, 0.20],
  Other: [0.15, 0.25],
};
const CITY_ZONES = ['Gulberg', 'DHA', 'Saddar', 'Johar Town', 'Cantt', 'Other'] as const;
const CATEGORIES = ['ride_hailing', 'food_delivery', 'freelance', 'domestic'] as const;
const COMPLAINT_CATEGORIES = [
  'commission_hike', 'account_deactivation', 'payment_delay',
  'unfair_rating', 'data_privacy', 'other',
] as const;
const COMPLAINT_STATUSES = ['open', 'escalated', 'resolved', 'rejected'] as const;
const POST_TYPES = ['rate_intel', 'complaint', 'support', 'general'] as const;
const ANOMALY_TYPES = ['deduction_spike', 'income_drop', 'hourly_rate_drop'] as const;
const ANOMALY_SEVERITIES = ['low', 'medium', 'high'] as const;

const ZONE_MULTIPLIER: Record<string, number> = {
  Gulberg: 1.08, DHA: 1.15, Saddar: 0.95, 'Johar Town': 1.02, Cantt: 1.06, Other: 1.0,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function randomInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomFloat(min: number, max: number) { return min + Math.random() * (max - min); }
function sample<T>(arr: readonly T[]): T { return arr[randomInt(0, arr.length - 1)]; }
function toMoney(v: number) { return Math.round(v * 100) / 100; }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; }
function monthsAgo(n: number) { const d = new Date(); d.setMonth(d.getMonth() - n); d.setDate(1); return d.toISOString().split('T')[0]; }

const NAMES = [
  'Ali Raza', 'Fatima Khan', 'Hassan Abbas', 'Ayesha Noor', 'Bilal Ahmed',
  'Sana Iqbal', 'Usman Tariq', 'Zainab Bibi', 'Omar Farooq', 'Hira Shah',
  'Kamran Malik', 'Nadia Parveen', 'Shahid Mehmood', 'Rabia Anwar', 'Junaid Hussain',
  'Maryam Aslam', 'Rizwan Khalid', 'Amna Yousaf', 'Waqar Zaman', 'Sadia Rehman',
  'Imran Qureshi', 'Bushra Javed', 'Naveed Akhtar', 'Asma Saleem', 'Adeel Siddiqui',
  'Lubna Pervez', 'Shoaib Rashid', 'Kiran Batool', 'Faisal Munir', 'Samina Begum',
  'Tahir Mahmood', 'Uzma Shafiq', 'Arif Nawaz', 'Rukhsana Khatoon', 'Yasir Riaz',
  'Farzana Gill', 'Zaheer Abbas', 'Nosheen Akram', 'Salman Haider', 'Parveen Akhtar',
  'Taimoor Ali', 'Shazia Bukhari', 'Hamza Rana', 'Iram Naz', 'Asad Mehmood',
  'Naila Sarwar', 'Danish Rauf', 'Sumaira Latif', 'Irfan Baig', 'Ghazala Yasmeen',
  'Nadeem Ullah', 'Fareeha Jabeen', 'Kashif Iqbal', 'Saima Arshad', 'Mudassar Ali',
  'Humaira Bibi', 'Shakeel Ahmad', 'Tehmina Durrani', 'Aamir Shahzad', 'Nasreen Taj',
];

const COMPLAINT_DESCRIPTIONS = [
  'Platform deductions increased from 25% to over 30% without any prior notice or explanation. This happened across multiple shifts in DHA zone.',
  'My account was deactivated without warning after I declined a long-distance ride. No appeal process was communicated to me at all.',
  'Payment for last week shifts still pending. It has been 8 days and platform support keeps giving generic auto-replies without resolution.',
  'Received unfair 2-star rating from a customer who cancelled midway. Platform refused to remove it despite evidence of completion.',
  'Platform tracks my GPS location 24/7 even when I am not working a shift. This violates basic data privacy rights of gig workers.',
  'Commission was hiked silently last month. I compared my January and February deductions and there is a clear 5% unexplained increase.',
  'Foodpanda changed the delivery radius algorithm so I get assigned longer routes but same flat rate pay per delivery order.',
  'Bykea payment delay has become a regular pattern. Every month the 2nd payment cycle is 3-5 days late without any communication.',
  'Got flagged for slow delivery when the restaurant took 25 minutes to prepare the food. Unfair rating should be on the restaurant.',
  'After updating the app, I noticed new permissions for camera and contacts that seem unnecessary for a ride-hailing platform.',
  'The incentive bonus promised for completing 50 rides was not credited even though I completed 54 rides as shown in my history.',
  'Platform customer support response time has degraded to 48+ hours for urgent payment issues that affect our daily livelihood.',
  'Surge pricing was applied for the customer but my driver cut remained at the non-surge rate creating a hidden commission increase.',
  'Account temporarily suspended after customer false complaint. Lost 3 days of income with no compensation for the wrongful action.',
  'Data export feature shows incomplete ride history making it impossible to properly audit my own earnings and deduction records.',
];

// ===========================================================================
// SEED FUNCTION
// ===========================================================================
async function seed() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required — set it in .env');
  const client = await pool.connect();

  console.log('🧹 Clearing ALL existing data (FK-safe order)...');
  const clearTables = [
    'community.post_moderations', 'community.posts',
    'grievance.complaint_upvotes', 'grievance.complaint_history',
    'grievance.complaints', 'grievance.complaint_clusters',
    'analytics.anomaly_logs', 'analytics.commission_snapshots',
    'earnings.shift_screenshots', 'earnings.verification_history',
    'earnings.csv_imports', 'earnings.shifts',
    'auth.refresh_tokens', 'auth.users',
  ];
  for (const t of clearTables) {
    try { await client.query(`DELETE FROM ${t}`); }
    catch { console.log(`   ⚠️ Table ${t} does not exist — skipping`); }
  }

  const passwordHash = await bcrypt.hash('password', 10);

  // =========================================================================
  // TABLE 1: auth.users — 100 workers + 5 verifiers + 5 advocates = 110 users
  // =========================================================================
  console.log('👤 Seeding auth.users (110 users)...');
  const workerIds: string[] = [];
  const verifierIds: string[] = [];
  const advocateIds: string[] = [];

  for (let i = 0; i < 100; i++) {
    // FORCE demo user (worker1) and 14 decoys into the EXACT same cohort
    // to absolutely guarantee the City Median Graph passes the k=5 anonymity threshold!
    let zone = sample(CITY_ZONES.slice(0, 5));
    let category = sample(CATEGORIES);

    if (i < 15) {
      zone = 'DHA';
      category = 'ride_hailing';
    }

    const r = await client.query(
      `INSERT INTO auth.users (name, email, password_hash, role, city_zone, category, phone, bio)
       VALUES ($1, $2, $3, 'worker'::auth.user_role, $4::auth.city_zone, $5::auth.worker_category, $6, $7)
       RETURNING id`,
      [NAMES[i % NAMES.length], `worker${i + 1}@fairgig.demo`, passwordHash, zone, category,
      `+92-${300 + randomInt(0, 99)}-${randomInt(1000000, 9999999)}`,
      `Gig worker in ${zone}, ${category.replace('_', ' ')} sector`],
    );
    workerIds.push(r.rows[0].id);
  }

  for (let i = 0; i < 5; i++) {
    const r = await client.query(
      `INSERT INTO auth.users (name, email, password_hash, role, bio)
       VALUES ($1, $2, $3, 'verifier'::auth.user_role, $4) RETURNING id`,
      [`Verifier ${i + 1}`, `verifier${i + 1}@fairgig.demo`, passwordHash,
        'FairGig earnings verification specialist'],
    );
    verifierIds.push(r.rows[0].id);
  }

  for (let i = 0; i < 5; i++) {
    const r = await client.query(
      `INSERT INTO auth.users (name, email, password_hash, role, bio)
       VALUES ($1, $2, $3, 'advocate'::auth.user_role, $4) RETURNING id`,
      [`Advocate ${i + 1}`, `advocate${i + 1}@fairgig.demo`, passwordHash,
        'FairGig worker rights advocate and grievance handler'],
    );
    advocateIds.push(r.rows[0].id);
  }

  // =========================================================================
  // TABLE 2: auth.refresh_tokens — 10 sample tokens
  // =========================================================================
  console.log('🔑 Seeding auth.refresh_tokens (10 tokens)...');
  for (let i = 0; i < 10; i++) {
    const userId = sample(workerIds);
    const tokenHash = crypto.createHash('sha256').update(crypto.randomBytes(48)).digest('hex');
    const expired = i < 3; // first 3 are expired/revoked
    await client.query(
      `INSERT INTO auth.refresh_tokens (user_id, token_hash, device_hint, expires_at, revoked, revoked_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, tokenHash,
        sample(['Chrome/Windows', 'Safari/iPhone', 'Firefox/Linux', 'App/Android']),
        expired ? new Date(Date.now() - 86400000).toISOString() : new Date(Date.now() + 604800000).toISOString(),
        expired, expired ? new Date().toISOString() : null],
    );
  }

  // =========================================================================
  // TABLE 3: earnings.csv_imports — 10 import records
  // =========================================================================
  console.log('📁 Seeding earnings.csv_imports (10 imports)...');
  const csvImportIds: string[] = [];
  for (let i = 0; i < 10; i++) {
    const wId = workerIds[i % workerIds.length];
    const total = randomInt(10, 50);
    const failed = i < 2 ? randomInt(1, 5) : 0;
    const imported = total - failed;
    const status = failed > 0 ? (imported === 0 ? 'failed' : 'partial') : 'done';
    const r = await client.query(
      `INSERT INTO earnings.csv_imports (worker_id, file_name, rows_total, rows_imported, rows_failed, status, error_log)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [wId, `earnings_export_${daysAgo(randomInt(1, 90))}.csv`, total, imported, failed, status,
        failed > 0 ? JSON.stringify([{ row: 3, error: 'invalid date format' }]) : null],
    );
    csvImportIds.push(r.rows[0].id);
  }

  // =========================================================================
  // TABLE 4: earnings.shifts — 100+ shifts per worker (6000+ total)
  // =========================================================================
  console.log('💰 Seeding earnings.shifts (~7000+ shifts, this may take a moment)...');
  const allShiftIds: string[] = [];
  const verifiedShiftIds: string[] = [];
  const pendingShiftIds: string[] = [];

  for (let w = 0; w < workerIds.length; w++) {
    const workerId = workerIds[w];
    const totalShifts = randomInt(90, 150);
    const spikeIndices = new Set<number>();
    while (spikeIndices.size < randomInt(5, 8)) spikeIndices.add(randomInt(0, totalShifts - 1));

    // Find user zone for wage multiplier
    const userRow = await client.query('SELECT city_zone FROM auth.users WHERE id = $1', [workerId]);
    const zone = userRow.rows[0].city_zone;

    // BATCH INSERT FOR SPEED
    const shiftPromises = [];
    for (let j = 0; j < totalShifts; j++) {
      const platformName = sample(PLATFORMS.slice(0, 4)); // exclude 'Other'
      const [minD, maxD] = PLATFORM_DEDUCTIONS[platformName];
      const shiftDate = daysAgo(randomInt(0, 180));
      const hours = toMoney(randomFloat(3, 12));
      const baseHourly = randomFloat(250, 520) * (ZONE_MULTIPLIER[zone] || 1.0);
      const gross = toMoney(hours * baseHourly);

      let deductionRate = randomFloat(minD, maxD);
      deductionRate = Math.max(minD, Math.min(maxD, deductionRate));
      if (spikeIndices.has(j)) deductionRate += randomFloat(0.08, 0.20);
      deductionRate = Math.min(deductionRate, 0.55);

      const deductions = toMoney(gross * deductionRate);
      const net = toMoney(gross - deductions);
      const isVerified = Math.random() < 0.75;
      const isCsvImport = j < 3 && w < csvImportIds.length;
      const verStatus = isVerified ? 'verified' : 'pending';
      const verifierId = isVerified ? sample(verifierIds) : null;

      shiftPromises.push(
        client.query(
          `INSERT INTO earnings.shifts
           (worker_id, platform, shift_date, hours_worked, gross_earned, platform_deductions,
            net_received, notes, is_csv_import, csv_import_id, has_screenshot,
            verification_status, verifier_id, verifier_note, verified_at)
           VALUES ($1, $2::earnings.platform_name, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                   $12::earnings.verify_status, $13, $14, $15)
           RETURNING id, verification_status`,
          [workerId, platformName, shiftDate, hours, gross, deductions, net,
            Math.random() < 0.2 ? 'Regular shift, no issues' : null,
            isCsvImport, isCsvImport ? csvImportIds[w % csvImportIds.length] : null,
            false, verStatus, verifierId,
            isVerified ? sample(['Screenshot matches', 'Verified via platform export', 'Amounts confirmed']) : null,
            isVerified ? new Date(Date.now() - randomInt(1, 30) * 86400000).toISOString() : null]
        )
      );

      // Execute in batches of 50 to avoid connection pooling limits / timeouts
      if (shiftPromises.length >= 50 || j === totalShifts - 1) {
        const results = await Promise.all(shiftPromises);
        for (const r of results) {
          const shiftId = r.rows[0].id;
          allShiftIds.push(shiftId);
          if (r.rows[0].verification_status === 'verified') verifiedShiftIds.push(shiftId);
          else pendingShiftIds.push(shiftId);
        }
        shiftPromises.length = 0; // Clear array for next batch
      }
    }

    if (w % 10 === 0) console.log(`   ... ${w + 1}/60 workers seeded`);
  }

  // =========================================================================
  // TABLE 5: earnings.shift_screenshots — 15+ screenshots
  // =========================================================================
  console.log('📸 Seeding earnings.shift_screenshots (15 screenshots)...');
  const screenshotShifts = [...pendingShiftIds.slice(0, 10), ...verifiedShiftIds.slice(0, 5)];
  for (const shiftId of screenshotShifts) {
    const workerRow = await client.query('SELECT worker_id FROM earnings.shifts WHERE id = $1', [shiftId]);
    const wId = workerRow.rows[0].worker_id;
    await client.query(
      `INSERT INTO earnings.shift_screenshots
       (shift_id, worker_id, file_url, file_name, file_size_bytes, mime_type, is_primary)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
      [shiftId, wId,
        `/uploads/screenshot_${shiftId.slice(0, 8)}.jpg`,
        `shift_proof_${shiftId.slice(0, 8)}.jpg`,
        randomInt(50000, 2000000),
        sample(['image/jpeg', 'image/png', 'image/webp'])],
    );
  }

  // =========================================================================
  // TABLE 6: earnings.verification_history — 15+ records
  // =========================================================================
  console.log('✅ Seeding earnings.verification_history (15 records)...');
  for (let i = 0; i < 15; i++) {
    const shiftId = verifiedShiftIds[i % verifiedShiftIds.length];
    await client.query(
      `INSERT INTO earnings.verification_history
       (shift_id, verifier_id, prev_status, new_status, note, decided_at)
       VALUES ($1, $2, 'pending'::earnings.verify_status, 'verified'::earnings.verify_status, $3, $4)`,
      [shiftId, sample(verifierIds),
        sample(['Screenshot matches records', 'Platform export confirmed', 'Amounts verified manually']),
        new Date(Date.now() - randomInt(1, 60) * 86400000).toISOString()],
    );
  }

  // =========================================================================
  // TABLE 7: grievance.complaint_clusters — 10 clusters
  // =========================================================================
  console.log('🗂️ Seeding grievance.complaint_clusters (10 clusters)...');
  const clusterIds: string[] = [];
  const clusterData = [
    { name: 'DHA Commission Surge — Careem', platform: 'Careem', tag: 'commission_change' },
    { name: 'Bykea Payment Delays Q1 2025', platform: 'Bykea', tag: 'payment_delay' },
    { name: 'Foodpanda Unfair Rating Pattern', platform: 'foodpanda', tag: 'unfair_rating' },
    { name: 'Careem Account Deactivations Surge', platform: 'Careem', tag: 'deactivation' },
    { name: 'Upwork Privacy Concerns', platform: 'Upwork', tag: 'data_privacy' },
    { name: 'Multi-Platform Commission Hikes', platform: null, tag: 'commission_hike' },
    { name: 'Saddar Zone Payment Issues', platform: null, tag: 'payment_delay' },
    { name: 'Ride-Hailing Incentive Disputes', platform: 'Careem', tag: 'incentive' },
    { name: 'Food Delivery Route Unfairness', platform: 'foodpanda', tag: 'route_manipulation' },
    { name: 'Cross-Platform Data Privacy', platform: null, tag: 'data_privacy' },
  ];
  for (const c of clusterData) {
    const r = await client.query(
      `INSERT INTO grievance.complaint_clusters (name, platform, primary_tag, complaint_count, created_by)
       VALUES ($1, $2, $3, 0, $4) RETURNING id`,
      [c.name, c.platform, c.tag, sample(advocateIds)],
    );
    clusterIds.push(r.rows[0].id);
  }

  // =========================================================================
  // TABLE 8: grievance.complaints — 45 complaints (competition minimum ≥ 20)
  // =========================================================================
  console.log('📢 Seeding grievance.complaints (45 complaints)...');
  const complaintIds: string[] = [];
  for (let i = 0; i < 45; i++) {
    const status = sample(COMPLAINT_STATUSES);
    const hasAdvocate = status !== 'open';
    const r = await client.query(
      `INSERT INTO grievance.complaints
       (worker_id, platform, category, description, is_anonymous, tags, status,
        advocate_id, advocate_note, cluster_id, upvotes)
       VALUES ($1, $2, $3::grievance.complaint_category, $4, $5, $6,
               $7::grievance.complaint_status, $8, $9, $10, 0)
       RETURNING id`,
      [
        sample(workerIds),
        sample([...PLATFORMS.slice(0, 4)]),
        sample([...COMPLAINT_CATEGORIES]),
        COMPLAINT_DESCRIPTIONS[i % COMPLAINT_DESCRIPTIONS.length],
        Math.random() < 0.25,
        [sample(['commission', 'deductions', 'payment', 'rating', 'privacy']),
        sample(['urgent', 'recurring', 'first-time'])],
        status,
        hasAdvocate ? sample(advocateIds) : null,
        hasAdvocate ? sample(['Under review', 'Escalated to platform', 'Evidence gathered', 'Resolution in progress']) : null,
        Math.random() < 0.5 ? sample(clusterIds) : null,
      ],
    );
    complaintIds.push(r.rows[0].id);
  }

  // Now update cluster complaint_count based on actual assignments
  await client.query(`
    UPDATE grievance.complaint_clusters cc
    SET complaint_count = (
      SELECT COUNT(*) FROM grievance.complaints c WHERE c.cluster_id = cc.id
    )
  `);

  // =========================================================================
  // TABLE 9: grievance.complaint_history — 15+ status changes
  // =========================================================================
  console.log('📜 Seeding grievance.complaint_history (15 records)...');
  for (let i = 0; i < 15; i++) {
    const cId = complaintIds[i % complaintIds.length];
    await client.query(
      `INSERT INTO grievance.complaint_history
       (complaint_id, changed_by, prev_status, new_status, note, changed_at)
       VALUES ($1, $2, $3::grievance.complaint_status, $4::grievance.complaint_status, $5, $6)`,
      [cId, sample(advocateIds),
        'open', sample(['escalated', 'resolved']),
        sample(['Reviewed and escalated', 'Duplicate resolved', 'Platform contacted']),
        new Date(Date.now() - randomInt(1, 30) * 86400000).toISOString()],
    );
  }

  // =========================================================================
  // TABLE 10: grievance.complaint_upvotes — 40+ upvotes
  // =========================================================================
  console.log('👍 Seeding grievance.complaint_upvotes (40 upvotes)...');
  const usedPairs = new Set<string>();
  let upvoteCount = 0;
  while (upvoteCount < 40) {
    const cId = sample(complaintIds);
    const uId = sample(workerIds);
    const key = `${cId}:${uId}`;
    if (usedPairs.has(key)) continue;
    usedPairs.add(key);
    try {
      await client.query(
        `INSERT INTO grievance.complaint_upvotes (complaint_id, user_id) VALUES ($1, $2)`,
        [cId, uId],
      );
      upvoteCount++;
    } catch { /* duplicate — skip */ }
  }

  // =========================================================================
  // TABLE 11: community.posts — 15 posts
  // =========================================================================
  const postIds: string[] = [];
  try {
    console.log('💬 Seeding community.posts (15 posts)...');
    const postsData = [
      { type: 'rate_intel', platform: 'Careem', title: 'Careem commission jumped in DHA this week', body: 'Watch out — Careem is now taking 30% in DHA area. Was 25% last week. Anyone else seeing this? Post numbers below so we can track.' },
      { type: 'rate_intel', platform: 'Bykea', title: 'Bykea rates stable in Gulberg', body: 'Good news for Gulberg riders — Bykea deductions still at 19%. Keep records in case they change. Verified with 5 drivers.' },
      { type: 'complaint', platform: 'foodpanda', title: 'Foodpanda late payments again this cycle', body: 'Three weeks running and foodpanda is paying late in Saddar. Anyone else affected? We should escalate this collectively.' },
      { type: 'support', platform: null, title: 'How to file a grievance properly on FairGig', body: 'For new workers: go to Grievance Board, click New Complaint, select category, write 20+ chars description with details.' },
      { type: 'general', platform: null, title: 'FairGig tips for new gig workers in Lahore', body: 'Always screenshot your earnings at the end of every shift. This makes the verification process much faster and smoother.' },
      { type: 'rate_intel', platform: 'Upwork', title: 'Upwork fee structure update — flat 10% now', body: 'Upwork now charges 10% flat instead of the tiered system. If you have longstanding clients renegotiate your rates.' },
      { type: 'complaint', platform: 'Careem', title: 'Unfair deactivation wave in Cantt area', body: 'Three drivers in Cantt zone got deactivated this week without warning. If you were affected please file a formal grievance.' },
      { type: 'support', platform: null, title: 'Understanding your FairGig income certificate', body: 'The income certificate only includes verified shifts. Make sure all your data is verified before generating one for bank loans.' },
      { type: 'general', platform: 'Bykea', title: 'Bykea weekly bonus program is back for March', body: 'Bykea is offering bonuses for 50+ rides per week again. DHA and Gulberg zones qualify. Check the Bykea app for details.' },
      { type: 'rate_intel', platform: 'foodpanda', title: 'Foodpanda deductions creeping up in Saddar', body: 'Noticed foodpanda deductions went from 30% to 33% in Saddar this week. Keep your screenshots to track and report.' },
      { type: 'complaint', platform: 'Careem', title: 'Careem surge pricing not reaching drivers', body: 'Customer paid surge pricing but driver payout was at the normal non-surge rate. This is a hidden commission hike and unfair practice.' },
      { type: 'support', platform: null, title: 'How to read your anomaly report on FairGig', body: 'The anomaly service checks for deduction spikes, income drops, and hourly rate drops. Green means stable, red means investigate.' },
      { type: 'general', platform: null, title: 'Community guidelines and moderation policy update', body: 'Please keep posts fact-based and include evidence when possible. False claims will be flagged by our advocate moderators.' },
      { type: 'rate_intel', platform: 'Bykea', title: 'Bykea Johar Town zone showing 20% cut', body: 'Bykea deductions in Johar Town have gone up to 20% from 18% over the past 2 weeks. Any other drivers confirming this trend?' },
      { type: 'complaint', platform: 'Upwork', title: 'Upwork hiding negative client reviews', body: 'Noticed that some negative client reviews on my proposals are suddenly hidden. Platform transparency is decreasing for freelancers.' },
    ];
    for (const p of postsData) {
      const r = await client.query(
        `INSERT INTO community.posts (worker_id, post_type, platform, title, body, is_approved, upvotes)
         VALUES ($1, $2::community.post_type, $3, $4, $5, TRUE, $6)
         RETURNING id`,
        [Math.random() < 0.6 ? sample(workerIds) : null,
        p.type, p.platform, p.title, p.body, randomInt(0, 25)],
      );
      postIds.push(r.rows[0].id);
    }
  } catch (e: any) {
    console.log(`   ⚠️ community.posts table missing — skipping (run neon_database.sql first). Error: ${e.message}`);
  }

  // =========================================================================
  // TABLE 12: community.post_moderations — 10 moderation actions
  // =========================================================================
  if (postIds.length > 0) {
    try {
      console.log('🛡️ Seeding community.post_moderations (10 records)...');
      for (let i = 0; i < 10; i++) {
        await client.query(
          `INSERT INTO community.post_moderations (post_id, advocate_id, action, reason)
           VALUES ($1, $2, $3::community.mod_action, $4)`,
          [postIds[i % postIds.length], sample(advocateIds),
          sample(['approved', 'approved', 'flagged']),
          sample(['Content verified', 'Legitimate report', 'Needs source verification', 'Approved after review'])],
        );
      }
    } catch (e: any) {
      console.log(`   ⚠️ community.post_moderations table missing — skipping. Error: ${e.message}`);
    }
  } else {
    console.log('   ⚠️ Skipping community.post_moderations (no posts to moderate)');
  }

  // =========================================================================
  // TABLE 13: analytics.anomaly_logs — 20 anomaly records
  // =========================================================================
  try {
    console.log('🔍 Seeding analytics.anomaly_logs (20 records)...');
    for (let i = 0; i < 20; i++) {
      await client.query(
        `INSERT INTO analytics.anomaly_logs
         (worker_id, anomaly_type, severity, affected_date, platform, explanation, risk_score)
         VALUES ($1, $2::analytics.anomaly_type, $3::analytics.anomaly_severity, $4, $5, $6, $7)`,
        [
          sample(workerIds),
          sample([...ANOMALY_TYPES]),
          sample([...ANOMALY_SEVERITIES]),
          daysAgo(randomInt(1, 90)),
          sample([...PLATFORMS.slice(0, 4)]),
          sample([
            'Deduction rate 42% vs your 3-month average 26% on Careem — possible commission hike',
            'Monthly net income dropped 28% from January to February — investigate platform changes',
            'Hourly net rate Rs.180/hr vs your 30-day average Rs.310/hr — significant drop detected',
            'Deduction spike detected: 38% vs historical mean 22% — flagged for advocate review',
            'Income drop of 35% detected this month vs last month across all platforms combined',
          ]),
          randomInt(15, 95),
        ],
      );
    }
  } catch (e: any) {
    console.log(`   ⚠️ analytics.anomaly_logs table missing — skipping. Error: ${e.message}`);
  }

  // =========================================================================
  // TABLE 14: analytics.commission_snapshots — 24 snapshots (4 platforms × 6 months)
  // =========================================================================
  try {
    console.log('📊 Seeding analytics.commission_snapshots (24 records)...');
    for (const platform of PLATFORMS.slice(0, 4)) {
      for (let m = 0; m < 6; m++) {
        const baseRate = PLATFORM_DEDUCTIONS[platform][0];
        const drift = randomFloat(-0.02, 0.03);
        await client.query(
          `INSERT INTO analytics.commission_snapshots
           (platform, snapshot_month, avg_deduction_rate, min_deduction_rate, max_deduction_rate,
            p25_deduction_rate, p75_deduction_rate, sample_shift_count, sample_worker_count)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (platform, snapshot_month) DO NOTHING`,
          [
            platform, monthsAgo(m),
            toMoney(baseRate + drift),
            toMoney(baseRate + drift - 0.05),
            toMoney(baseRate + drift + 0.08),
            toMoney(baseRate + drift - 0.02),
            toMoney(baseRate + drift + 0.04),
            randomInt(200, 800), randomInt(15, 50),
          ],
        );
      }
    }
  } catch (e: any) {
    console.log(`   ⚠️ analytics.commission_snapshots table missing — skipping. Error: ${e.message}`);
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n📋 Verifying row counts...');
  const tables = [
    'auth.users', 'auth.refresh_tokens',
    'earnings.shifts', 'earnings.shift_screenshots', 'earnings.verification_history', 'earnings.csv_imports',
    'grievance.complaint_clusters', 'grievance.complaints', 'grievance.complaint_history', 'grievance.complaint_upvotes',
    'community.posts', 'community.post_moderations',
    'analytics.anomaly_logs', 'analytics.commission_snapshots',
  ];

  console.log('\n✅ SEED COMPLETE');
  console.log('━'.repeat(50));
  for (const t of tables) {
    try {
      const r = await client.query(`SELECT COUNT(*)::int AS c FROM ${t}`);
      const c = r.rows[0].c;
      const status = c >= 10 ? '✅' : c > 0 ? '⚠️' : '❌';
      console.log(`${status} ${t.padEnd(38)} ${String(c).padStart(6)} rows`);
    } catch {
      console.log(`⚠️  ${t.padEnd(38)}  TABLE MISSING`);
    }
  }
  console.log('━'.repeat(50));

  // Check views
  console.log('\n📊 Checking views...');
  const viewChecks = [
    'SELECT COUNT(*) AS c FROM analytics.v_city_zone_medians',
    'SELECT COUNT(*) AS c FROM analytics.v_commission_trends',
    'SELECT COUNT(*) AS c FROM analytics.v_income_distribution',
    'SELECT COUNT(*) AS c FROM analytics.v_top_complaints',
    'SELECT COUNT(*) AS c FROM analytics.v_verifier_queue',
  ];
  for (const q of viewChecks) {
    try {
      const r = await client.query(q);
      const viewName = q.match(/FROM\s+([\w.]+)/)?.[1] || '?';
      console.log(`   ${viewName}: ${r.rows[0].c} rows`);
    } catch (e: any) {
      console.log(`   ⚠️ View missing: ${e.message.split('\n')[0]}`);
    }
  }

  client.release();
  await pool.end();
  console.log('\n🎉 Done! Run `npm run dev` to start the platform.');
}

seed().catch(console.error);
