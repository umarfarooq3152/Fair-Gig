import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

async function applySchema() {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is required — set it in .env');
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
    });

    const schemaPath = path.resolve('neon_database.sql');
    if (!fs.existsSync(schemaPath)) {
        throw new Error('neon_database.sql not found in project root');
    }

    const sql = fs.readFileSync(schemaPath, 'utf-8');

    console.log('🔧 Applying neon_database.sql to your Neon database...');
    console.log(`   Connection: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);
    console.log(`   Schema file: ${schemaPath} (${sql.length} chars)\n`);

    try {
        await pool.query(sql);
        console.log('✅ Schema applied successfully!\n');
    } catch (err: any) {
        // If there are "already exists" errors, that's fine — means partial schema was there
        if (err.message.includes('already exists')) {
            console.log(`⚠️ Some objects already existed (this is normal): ${err.message.split('\n')[0]}`);
            console.log('   Attempting to apply remaining statements...\n');

            // Split and apply statement by statement for partial application
            const statements = sql
                .split(/;\s*\n/)
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith('--'));

            let applied = 0;
            let skipped = 0;
            for (const stmt of statements) {
                try {
                    await pool.query(stmt);
                    applied++;
                } catch (e: any) {
                    if (e.message.includes('already exists') || e.message.includes('duplicate')) {
                        skipped++;
                    } else {
                        console.log(`   ❌ Error: ${e.message.split('\n')[0]}`);
                    }
                }
            }
            console.log(`   Applied: ${applied} statements, Skipped (already exist): ${skipped}\n`);
        } else {
            throw err;
        }
    }

    // Verify tables exist
    console.log('📋 Verifying tables...');
    const tables = [
        'auth.users', 'auth.refresh_tokens',
        'earnings.shifts', 'earnings.shift_screenshots', 'earnings.verification_history', 'earnings.csv_imports',
        'grievance.complaint_clusters', 'grievance.complaints', 'grievance.complaint_history', 'grievance.complaint_upvotes',
        'community.posts', 'community.post_moderations',
        'analytics.anomaly_logs', 'analytics.commission_snapshots',
    ];

    for (const t of tables) {
        try {
            await pool.query(`SELECT 1 FROM ${t} LIMIT 1`);
            console.log(`   ✅ ${t}`);
        } catch {
            console.log(`   ❌ ${t} — MISSING`);
        }
    }

    await pool.end();
    console.log('\n🎉 Done! Now run: npm run seed');
}

applySchema().catch(err => {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
});
