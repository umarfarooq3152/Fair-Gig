import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkDb() {
    try {
        const workerCount = await pool.query("SELECT COUNT(*) FROM auth.users WHERE role = 'worker';");
        console.log("workerCount:", workerCount.rows[0].count);

        const shiftsCount = await pool.query("SELECT COUNT(*) FROM earnings.shifts;");
        console.log("shiftsCount:", shiftsCount.rows[0].count);

        const platformsCount = await pool.query("SELECT COUNT(DISTINCT platform) FROM earnings.shifts;");
        console.log("platformsCount:", platformsCount.rows[0].count);

        const cityZoneCount = await pool.query("SELECT COUNT(DISTINCT city_zone) FROM auth.users;");
        console.log("cityZoneCount:", cityZoneCount.rows[0].count);

        const monthsCount = await pool.query("SELECT COUNT(DISTINCT EXTRACT(MONTH FROM shift_date)) FROM earnings.shifts;");
        console.log("monthsCount:", monthsCount.rows[0].count);

        const complaintsCount = await pool.query("SELECT COUNT(*) FROM grievance.complaints;");
        console.log("complaintsCount:", complaintsCount.rows[0].count);

        // 2.3 Data Quality
        const impossibleEarnings = await pool.query("SELECT COUNT(*) FROM earnings.shifts WHERE gross_earned < platform_deductions;");
        console.log("impossibleEarnings:", impossibleEarnings.rows[0].count);

        const mathError = await pool.query("SELECT COUNT(*) FROM earnings.shifts WHERE net_received != (gross_earned - platform_deductions);");
        console.log("mathError:", mathError.rows[0].count);

        const invalidRole = await pool.query("SELECT COUNT(*) FROM auth.users WHERE role NOT IN ('worker', 'verifier', 'advocate');");
        console.log("invalidRole:", invalidRole.rows[0].count);

        const orphanedShifts = await pool.query("SELECT COUNT(*) FROM earnings.shifts s LEFT JOIN auth.users u ON s.worker_id = u.id WHERE u.id IS NULL;");
        console.log("orphanedShifts:", orphanedShifts.rows[0].count);

        const workersPerCity = await pool.query("SELECT city_zone, COUNT(*) FROM auth.users WHERE role='worker' GROUP BY city_zone;");
        console.log("workersPerCity:", JSON.stringify(workersPerCity.rows));

        const deductionRates = await pool.query(`
      SELECT platform, 
             MIN(platform_deductions / NULLIF(gross_earned, 0)) as min_rate, 
             MAX(platform_deductions / NULLIF(gross_earned, 0)) as max_rate 
      FROM earnings.shifts 
      GROUP BY platform;
    `);
        console.log("deductionRates:", JSON.stringify(deductionRates.rows));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkDb();
