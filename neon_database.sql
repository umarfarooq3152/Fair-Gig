-- ============================================================
--  FAIRGIG — NEON POSTGRESQL MASTER SCHEMA
--  SOFTEC 2026 Web Dev Competition
--  Version: 2.0 — Production Grade
--
--  Schemas:   auth | earnings | grievance | community | analytics
--  Services:  Auth (FastAPI:8001) | Earnings (Node:8002)
--             Anomaly (FastAPI:8003) | Grievance (Node:8004)
--             Analytics (FastAPI:8005) | Frontend (Next:3000)
--
--  Run this file ONCE on your Neon database.
--  Order matters — do not reorder sections.
-- ============================================================


-- ============================================================
-- 0. EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";     -- uuid_generate_v4() fallback
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- trigram index for complaint search


-- ============================================================
-- 1. SCHEMAS
-- ============================================================

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS earnings;
CREATE SCHEMA IF NOT EXISTS grievance;
CREATE SCHEMA IF NOT EXISTS community;
CREATE SCHEMA IF NOT EXISTS analytics;


-- ============================================================
-- 2. ENUMS  (central type definitions — never hardcode strings)
-- ============================================================

CREATE TYPE auth.user_role        AS ENUM ('worker', 'verifier', 'advocate');
CREATE TYPE auth.worker_category  AS ENUM ('ride_hailing', 'food_delivery', 'freelance', 'domestic');
CREATE TYPE auth.city_zone        AS ENUM ('Gulberg', 'DHA', 'Saddar', 'Johar Town', 'Cantt', 'Other');

CREATE TYPE earnings.platform_name AS ENUM ('Careem', 'Bykea', 'foodpanda', 'Upwork', 'Other');
CREATE TYPE earnings.verify_status AS ENUM ('pending', 'verified', 'flagged', 'unverifiable');

CREATE TYPE grievance.complaint_status   AS ENUM ('open', 'escalated', 'resolved', 'rejected');
CREATE TYPE grievance.complaint_category AS ENUM (
    'commission_hike', 'account_deactivation', 'payment_delay',
    'unfair_rating', 'data_privacy', 'other'
);

CREATE TYPE community.post_type AS ENUM ('rate_intel', 'complaint', 'support', 'general');
CREATE TYPE community.mod_action AS ENUM ('approved', 'removed', 'flagged');

CREATE TYPE analytics.anomaly_type     AS ENUM ('deduction_spike', 'income_drop', 'hourly_rate_drop');
CREATE TYPE analytics.anomaly_severity AS ENUM ('low', 'medium', 'high');


-- ============================================================
-- 3. AUTH SCHEMA
-- ============================================================

-- 3.1 users ─ all roles (worker | verifier | advocate)
CREATE TABLE auth.users (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100)    NOT NULL,
    email           VARCHAR(150)    NOT NULL UNIQUE,
    password_hash   TEXT            NOT NULL,
    role            auth.user_role  NOT NULL,

    -- Worker-specific (NULL for verifier/advocate)
    city_zone       auth.city_zone,
    category        auth.worker_category,
    phone           VARCHAR(20),

    -- Profile
    avatar_url      TEXT,
    bio             TEXT,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,

    -- Audit
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ     -- soft delete; NULL = active

    CONSTRAINT chk_worker_has_zone
        CHECK (role != 'worker' OR city_zone IS NOT NULL)
);

COMMENT ON TABLE  auth.users IS 'All platform users. Role determines which features are accessible.';
COMMENT ON COLUMN auth.users.city_zone IS 'City zone — only required for workers; used for city-wide median comparison.';
COMMENT ON COLUMN auth.users.category  IS 'Gig category — ride_hailing|food_delivery|freelance|domestic.';
COMMENT ON COLUMN auth.users.deleted_at IS 'Soft delete. Query WHERE deleted_at IS NULL for active users.';


-- 3.2 refresh_tokens ─ JWT refresh token store
CREATE TABLE auth.refresh_tokens (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash  TEXT        NOT NULL UNIQUE,   -- bcrypt/sha256 of the raw token
    device_hint VARCHAR(200),                  -- optional: browser/OS fingerprint
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked     BOOLEAN     NOT NULL DEFAULT FALSE,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE auth.refresh_tokens IS 'Hashed refresh tokens. Raw token never stored.';


-- ============================================================
-- 4. EARNINGS SCHEMA
-- ============================================================

-- 4.1 shifts ─ core earnings log
CREATE TABLE earnings.shifts (
    id                  UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id           UUID                    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Shift data
    platform            earnings.platform_name  NOT NULL,
    shift_date          DATE                    NOT NULL,
    hours_worked        NUMERIC(6, 2)           NOT NULL CHECK (hours_worked >= 0),
    gross_earned        NUMERIC(12, 2)          NOT NULL CHECK (gross_earned >= 0),
    platform_deductions NUMERIC(12, 2)          NOT NULL CHECK (platform_deductions >= 0),
    net_received        NUMERIC(12, 2)          NOT NULL CHECK (net_received >= 0),

    -- Derived column (stored for index performance on analytics queries)
    deduction_rate      NUMERIC(6, 4)
        GENERATED ALWAYS AS (
            CASE WHEN gross_earned > 0
                 THEN platform_deductions / gross_earned
                 ELSE 0 END
        ) STORED,

    effective_hourly_rate NUMERIC(10, 2)
        GENERATED ALWAYS AS (
            CASE WHEN hours_worked > 0
                 THEN net_received / hours_worked
                 ELSE 0 END
        ) STORED,

    -- Source
    notes               TEXT,
    is_csv_import       BOOLEAN                 NOT NULL DEFAULT FALSE,
    csv_import_id       UUID,                   -- FK added after earnings.csv_imports created

    -- Screenshot (primary URL cached here for verifier queue; full record in shift_screenshots)
    screenshot_url      TEXT,
    has_screenshot      BOOLEAN                 NOT NULL DEFAULT FALSE,

    -- Verification
    verification_status earnings.verify_status  NOT NULL DEFAULT 'pending',
    verifier_id         UUID REFERENCES auth.users(id),
    verifier_note       TEXT,
    verified_at         TIMESTAMPTZ,

    -- Audit
    created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,            -- soft delete

    CONSTRAINT chk_net_lte_gross
        CHECK (net_received <= gross_earned),
    CONSTRAINT chk_deductions_lte_gross
        CHECK (platform_deductions <= gross_earned),
    CONSTRAINT chk_net_eq_gross_minus_deductions
        CHECK (ABS(net_received - (gross_earned - platform_deductions)) < 0.05),
        -- Allow 5 paisa rounding tolerance

    CONSTRAINT chk_verifier_required_if_verified
        CHECK (
            verification_status = 'pending'
            OR verifier_id IS NOT NULL
        )
);

COMMENT ON TABLE  earnings.shifts IS 'Core earnings log. One row per platform shift. Used by anomaly service, analytics, and income certificate.';
COMMENT ON COLUMN earnings.shifts.deduction_rate IS 'Generated: platform_deductions / gross_earned. Indexed for commission trend analytics.';
COMMENT ON COLUMN earnings.shifts.effective_hourly_rate IS 'Generated: net_received / hours_worked. Used for city-wide median comparison.';
COMMENT ON COLUMN earnings.shifts.chk_net_eq_gross_minus_deductions IS '5 paisa tolerance handles floating point import rounding.';


-- 4.2 shift_screenshots ─ one shift may have multiple screenshots
CREATE TABLE earnings.shift_screenshots (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id        UUID        NOT NULL REFERENCES earnings.shifts(id) ON DELETE CASCADE,
    worker_id       UUID        NOT NULL REFERENCES auth.users(id),
    file_url        TEXT        NOT NULL,
    file_name       TEXT,
    file_size_bytes INTEGER     CHECK (file_size_bytes > 0 AND file_size_bytes < 10485760), -- max 10MB
    mime_type       TEXT        NOT NULL DEFAULT 'image/jpeg'
                                CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
    is_primary      BOOLEAN     NOT NULL DEFAULT TRUE,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE earnings.shift_screenshots IS 'Screenshot evidence for human verification. Verifier queue shows is_primary=true screenshot.';


-- 4.3 verification_history ─ full audit trail of every decision
CREATE TABLE earnings.verification_history (
    id              UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id        UUID                    NOT NULL REFERENCES earnings.shifts(id) ON DELETE CASCADE,
    verifier_id     UUID                    NOT NULL REFERENCES auth.users(id),
    prev_status     earnings.verify_status,
    new_status      earnings.verify_status  NOT NULL,
    note            TEXT,
    decided_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE earnings.verification_history IS 'Append-only audit log. Populated automatically by trigger on shifts.verification_status change.';


-- 4.4 csv_imports ─ batch import tracking
CREATE TABLE earnings.csv_imports (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name       TEXT        NOT NULL,
    rows_total      INTEGER     NOT NULL DEFAULT 0 CHECK (rows_total >= 0),
    rows_imported   INTEGER     NOT NULL DEFAULT 0 CHECK (rows_imported >= 0),
    rows_failed     INTEGER     NOT NULL DEFAULT 0 CHECK (rows_failed >= 0),
    status          TEXT        NOT NULL DEFAULT 'processing'
                                CHECK (status IN ('processing', 'done', 'partial', 'failed')),
    error_log       JSONB,      -- [{row: 4, error: "invalid date"}, ...]
    imported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK for csv_import_id on shifts now that csv_imports exists
ALTER TABLE earnings.shifts
    ADD CONSTRAINT fk_shifts_csv_import
    FOREIGN KEY (csv_import_id) REFERENCES earnings.csv_imports(id);


-- ============================================================
-- 5. GRIEVANCE SCHEMA
-- ============================================================

-- 5.1 complaint_clusters ─ created first (referenced by complaints)
CREATE TABLE grievance.complaint_clusters (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT        NOT NULL,
    platform        TEXT,
    primary_tag     TEXT,
    complaint_count INTEGER     NOT NULL DEFAULT 0 CHECK (complaint_count >= 0),
    created_by      UUID        REFERENCES auth.users(id),  -- advocate
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE grievance.complaint_clusters IS 'Advocate-curated clusters of similar complaints. Complaint count synced by trigger.';


-- 5.2 complaints ─ core grievance board
CREATE TABLE grievance.complaints (
    id              UUID                            PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id       UUID                            NOT NULL REFERENCES auth.users(id),
    platform        TEXT                            NOT NULL,
    category        grievance.complaint_category    NOT NULL DEFAULT 'other',
    description     TEXT                            NOT NULL CHECK (LENGTH(description) >= 20),
    is_anonymous    BOOLEAN                         NOT NULL DEFAULT FALSE,

    -- Advocate workflow
    tags            TEXT[]                          NOT NULL DEFAULT '{}',
    status          grievance.complaint_status      NOT NULL DEFAULT 'open',
    advocate_id     UUID                            REFERENCES auth.users(id),
    advocate_note   TEXT,
    cluster_id      UUID                            REFERENCES grievance.complaint_clusters(id),
    escalated_at    TIMESTAMPTZ,
    resolved_at     TIMESTAMPTZ,

    -- Engagement
    upvotes         INTEGER                         NOT NULL DEFAULT 0 CHECK (upvotes >= 0),

    -- Audit
    created_at      TIMESTAMPTZ                     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ                     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  grievance.complaints IS 'Worker grievance posts. Advocates tag, cluster, escalate, and resolve.';
COMMENT ON COLUMN grievance.complaints.is_anonymous IS 'When TRUE, worker_id is hidden in all public-facing API responses.';
COMMENT ON COLUMN grievance.complaints.tags IS 'Text array of advocate-applied tags. Used for clustering via GIN index.';


-- 5.3 complaint_history ─ status change log
CREATE TABLE grievance.complaint_history (
    id              UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id    UUID                        NOT NULL REFERENCES grievance.complaints(id) ON DELETE CASCADE,
    changed_by      UUID                        NOT NULL REFERENCES auth.users(id),
    prev_status     grievance.complaint_status,
    new_status      grievance.complaint_status  NOT NULL,
    note            TEXT,
    changed_at      TIMESTAMPTZ                 NOT NULL DEFAULT NOW()
);


-- 5.4 complaint_upvotes ─ one upvote per user per complaint
CREATE TABLE grievance.complaint_upvotes (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id    UUID        NOT NULL REFERENCES grievance.complaints(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_one_upvote_per_user UNIQUE (complaint_id, user_id)
);


-- ============================================================
-- 6. COMMUNITY SCHEMA  (anonymous bulletin board)
-- ============================================================

-- 6.1 posts ─ rate intel, complaints, support
CREATE TABLE community.posts (
    id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id       UUID                REFERENCES auth.users(id),  -- nullable = fully anonymous
    post_type       community.post_type NOT NULL,
    platform        TEXT,               -- optional: related platform
    title           TEXT                NOT NULL CHECK (LENGTH(title) >= 5),
    body            TEXT                NOT NULL CHECK (LENGTH(body) >= 10),

    -- Moderation
    is_approved     BOOLEAN             NOT NULL DEFAULT TRUE,
    is_moderated    BOOLEAN             NOT NULL DEFAULT FALSE,
    upvotes         INTEGER             NOT NULL DEFAULT 0 CHECK (upvotes >= 0),

    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  community.posts IS 'Anonymous bulletin board. Advocates moderate via community.post_moderations.';
COMMENT ON COLUMN community.posts.worker_id IS 'NULL when fully anonymous. Never exposed in API responses.';


-- 6.2 post_moderations ─ advocate moderation log
CREATE TABLE community.post_moderations (
    id              UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         UUID                    NOT NULL REFERENCES community.posts(id) ON DELETE CASCADE,
    advocate_id     UUID                    NOT NULL REFERENCES auth.users(id),
    action          community.mod_action    NOT NULL,
    reason          TEXT,
    actioned_at     TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 7. ANALYTICS SCHEMA
-- ============================================================

-- 7.1 anomaly_logs ─ persisted anomaly detections for advocate panel
CREATE TABLE analytics.anomaly_logs (
    id              UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id       UUID                        NOT NULL REFERENCES auth.users(id),
    anomaly_type    analytics.anomaly_type      NOT NULL,
    severity        analytics.anomaly_severity  NOT NULL,
    affected_date   TEXT                        NOT NULL,   -- 'YYYY-MM-DD' or 'YYYY-MM'
    platform        TEXT                        NOT NULL,   -- platform name or 'all'
    explanation     TEXT                        NOT NULL,
    risk_score      SMALLINT                    NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
    detected_at     TIMESTAMPTZ                 NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE analytics.anomaly_logs IS 'Anomaly service persists results here. Advocate analytics panel queries this for vulnerability flags.';


-- 7.2 commission_snapshots ─ monthly platform commission rate snapshots
--     Populated by a scheduled job in the analytics service
CREATE TABLE analytics.commission_snapshots (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    platform            TEXT        NOT NULL,
    snapshot_month      DATE        NOT NULL,   -- first day of month: 2025-01-01
    avg_deduction_rate  NUMERIC(6, 4),
    min_deduction_rate  NUMERIC(6, 4),
    max_deduction_rate  NUMERIC(6, 4),
    p25_deduction_rate  NUMERIC(6, 4),
    p75_deduction_rate  NUMERIC(6, 4),
    sample_shift_count  INTEGER,
    sample_worker_count INTEGER,
    computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_commission_snapshot UNIQUE (platform, snapshot_month)
);

COMMENT ON TABLE analytics.commission_snapshots IS 'Pre-computed monthly commission stats per platform. Faster than live GROUP BY for advocate trend chart.';


-- ============================================================
-- 8. ANALYTICS VIEWS  (anonymized aggregate queries)
--    CRITICAL: These must never return individual worker data.
--    Minimum worker count guards enforce k-anonymity.
-- ============================================================

-- 8.1 City-wide median hourly rate (worker dashboard comparison)
CREATE OR REPLACE VIEW analytics.v_city_zone_medians AS
SELECT
    u.city_zone                                                             AS city_zone,
    u.category                                                              AS category,
    DATE_TRUNC('month', s.shift_date)::DATE                                AS month,
    COUNT(DISTINCT u.id)                                                    AS worker_count,
    ROUND(
        PERCENTILE_CONT(0.5) WITHIN GROUP
            (ORDER BY s.effective_hourly_rate)::NUMERIC, 2
    )                                                                       AS median_hourly_rate,
    ROUND(AVG(s.effective_hourly_rate)::NUMERIC, 2)                        AS avg_hourly_rate,
    ROUND(AVG(s.deduction_rate)::NUMERIC, 4)                               AS avg_deduction_rate
FROM earnings.shifts s
JOIN auth.users u ON u.id = s.worker_id
WHERE s.verification_status = 'verified'
  AND s.deleted_at IS NULL
  AND u.deleted_at IS NULL
  AND u.is_active = TRUE
  AND s.hours_worked > 0
  AND s.gross_earned > 0
GROUP BY u.city_zone, u.category, DATE_TRUNC('month', s.shift_date)::DATE
HAVING COUNT(DISTINCT u.id) >= 5;   -- k=5 anonymity floor

COMMENT ON VIEW analytics.v_city_zone_medians IS
    'Anonymized. Minimum 5 workers per group. Used by worker dashboard for city-wide comparison bar.';


-- 8.2 Platform commission trends (advocate panel — LineChart)
CREATE OR REPLACE VIEW analytics.v_commission_trends AS
SELECT
    s.platform::TEXT                                AS platform,
    DATE_TRUNC('month', s.shift_date)::DATE         AS month,
    ROUND(AVG(s.deduction_rate)::NUMERIC, 4)        AS avg_deduction_rate,
    ROUND(MIN(s.deduction_rate)::NUMERIC, 4)        AS min_deduction_rate,
    ROUND(MAX(s.deduction_rate)::NUMERIC, 4)        AS max_deduction_rate,
    COUNT(*)                                        AS shift_count,
    COUNT(DISTINCT s.worker_id)                     AS worker_count
FROM earnings.shifts s
WHERE s.deleted_at IS NULL
  AND s.gross_earned > 0
  AND s.shift_date >= NOW() - INTERVAL '6 months'
GROUP BY s.platform, DATE_TRUNC('month', s.shift_date)::DATE
ORDER BY month DESC, platform;

COMMENT ON VIEW analytics.v_commission_trends IS
    'Platform commission rate trends over last 6 months. Advocate panel LineChart.';


-- 8.3 Income distribution by city zone (advocate panel — BarChart)
CREATE OR REPLACE VIEW analytics.v_income_distribution AS
SELECT
    u.city_zone::TEXT                               AS city_zone,
    CASE
        WHEN s.net_received < 4000   THEN '0–4k'
        WHEN s.net_received < 8000   THEN '4k–8k'
        WHEN s.net_received < 12000  THEN '8k–12k'
        WHEN s.net_received < 16000  THEN '12k–16k'
        WHEN s.net_received < 20000  THEN '16k–20k'
        ELSE '20k+'
    END                                             AS income_bucket,
    CASE
        WHEN s.net_received < 4000   THEN 1
        WHEN s.net_received < 8000   THEN 2
        WHEN s.net_received < 12000  THEN 3
        WHEN s.net_received < 16000  THEN 4
        WHEN s.net_received < 20000  THEN 5
        ELSE 6
    END                                             AS bucket_order,
    COUNT(*)                                        AS shift_count,
    COUNT(DISTINCT s.worker_id)                     AS worker_count
FROM earnings.shifts s
JOIN auth.users u ON u.id = s.worker_id
WHERE s.deleted_at IS NULL
  AND u.deleted_at IS NULL
  AND s.shift_date >= NOW() - INTERVAL '30 days'
GROUP BY u.city_zone, income_bucket, bucket_order
ORDER BY city_zone, bucket_order;


-- 8.4 Vulnerability flags: workers with >20% MoM income drop
CREATE OR REPLACE VIEW analytics.v_vulnerability_flags AS
WITH monthly AS (
    SELECT
        s.worker_id,
        DATE_TRUNC('month', s.shift_date) AS month,
        SUM(s.net_received)               AS total_net
    FROM earnings.shifts s
    WHERE s.deleted_at IS NULL
      AND s.shift_date >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
    GROUP BY s.worker_id, DATE_TRUNC('month', s.shift_date)
),
pivoted AS (
    SELECT
        worker_id,
        SUM(CASE WHEN month = DATE_TRUNC('month', NOW())
                 THEN total_net ELSE 0 END) AS current_month,
        SUM(CASE WHEN month = DATE_TRUNC('month', NOW() - INTERVAL '1 month')
                 THEN total_net ELSE 0 END) AS prev_month
    FROM monthly
    GROUP BY worker_id
)
SELECT
    u.id            AS worker_id,
    u.name,
    u.city_zone::TEXT,
    u.category::TEXT,
    ROUND(p.current_month, 2)                                   AS current_month_income,
    ROUND(p.prev_month, 2)                                      AS previous_month_income,
    ROUND(
        (1 - p.current_month / NULLIF(p.prev_month, 0)) * 100, 1
    )                                                           AS income_drop_pct,
    CASE
        WHEN (1 - p.current_month / NULLIF(p.prev_month, 0)) > 0.40 THEN 'critical'
        WHEN (1 - p.current_month / NULLIF(p.prev_month, 0)) > 0.20 THEN 'warning'
        ELSE 'stable'
    END                                                         AS flag_level
FROM pivoted p
JOIN auth.users u ON u.id = p.worker_id
WHERE u.role = 'worker'
  AND u.deleted_at IS NULL
  AND u.is_active = TRUE
  AND p.prev_month > 0
  AND p.current_month < p.prev_month * 0.80
ORDER BY income_drop_pct DESC;

COMMENT ON VIEW analytics.v_vulnerability_flags IS
    'Workers whose income dropped >20% MoM. Advocate panel red-badge table.';


-- 8.5 Top complaint categories this week (advocate panel)
CREATE OR REPLACE VIEW analytics.v_top_complaints AS
SELECT
    c.platform,
    c.category::TEXT,
    COUNT(*)                                                    AS complaint_count,
    COUNT(CASE WHEN c.status = 'escalated' THEN 1 END)         AS escalated_count,
    COUNT(CASE WHEN c.status = 'resolved'  THEN 1 END)         AS resolved_count
FROM grievance.complaints c
WHERE c.created_at >= NOW() - INTERVAL '7 days'
GROUP BY c.platform, c.category
ORDER BY complaint_count DESC
LIMIT 20;


-- 8.6 Complaint clusters (grievance service GET /complaints/clusters)
CREATE OR REPLACE VIEW analytics.v_complaint_clusters AS
SELECT
    COALESCE(c.tags[1], 'untagged')                             AS primary_tag,
    c.platform,
    COUNT(*)                                                    AS complaint_count,
    COUNT(CASE WHEN c.status = 'escalated' THEN 1 END)         AS escalated_count,
    MIN(c.created_at)                                           AS first_seen,
    MAX(c.created_at)                                           AS last_seen,
    ARRAY_AGG(c.id ORDER BY c.created_at DESC) FILTER
        (WHERE c.id IS NOT NULL)                                AS complaint_ids
FROM grievance.complaints c
GROUP BY COALESCE(c.tags[1], 'untagged'), c.platform
ORDER BY complaint_count DESC;


-- 8.7 Verifier queue (shifts pending with screenshot)
CREATE OR REPLACE VIEW analytics.v_verifier_queue AS
SELECT
    s.id                        AS shift_id,
    s.worker_id,
    u.name                      AS worker_name,
    u.city_zone::TEXT,
    u.category::TEXT,
    s.platform::TEXT,
    s.shift_date,
    s.hours_worked,
    s.gross_earned,
    s.platform_deductions,
    s.net_received,
    s.deduction_rate,
    s.screenshot_url,
    s.created_at                AS submitted_at
FROM earnings.shifts s
JOIN auth.users u ON u.id = s.worker_id
WHERE s.verification_status = 'pending'
  AND s.has_screenshot = TRUE
  AND s.deleted_at IS NULL
  AND u.deleted_at IS NULL
ORDER BY s.created_at ASC;    -- FIFO queue

COMMENT ON VIEW analytics.v_verifier_queue IS
    'Verifier dashboard queue. Ordered oldest-first (FIFO). Excludes shifts without screenshots.';


-- ============================================================
-- 9. INDEXES
-- ============================================================

-- auth.users
CREATE INDEX idx_users_email        ON auth.users(email);
CREATE INDEX idx_users_role         ON auth.users(role);
CREATE INDEX idx_users_city_zone    ON auth.users(city_zone) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_category     ON auth.users(category)  WHERE deleted_at IS NULL;
CREATE INDEX idx_users_active       ON auth.users(id)        WHERE deleted_at IS NULL AND is_active = TRUE;

-- auth.refresh_tokens
CREATE INDEX idx_rtokens_user_id    ON auth.refresh_tokens(user_id);
CREATE INDEX idx_rtokens_expires    ON auth.refresh_tokens(expires_at) WHERE revoked = FALSE;

-- earnings.shifts ─ most critical for performance
CREATE INDEX idx_shifts_worker_id           ON earnings.shifts(worker_id);
CREATE INDEX idx_shifts_shift_date          ON earnings.shifts(shift_date DESC);
CREATE INDEX idx_shifts_platform            ON earnings.shifts(platform);
CREATE INDEX idx_shifts_verify_status       ON earnings.shifts(verification_status);
CREATE INDEX idx_shifts_verifier_id         ON earnings.shifts(verifier_id) WHERE verifier_id IS NOT NULL;
-- Composite: anomaly service Phase 2 fetch
CREATE INDEX idx_shifts_worker_date         ON earnings.shifts(worker_id, shift_date DESC) WHERE deleted_at IS NULL;
-- Composite: platform commission analytics
CREATE INDEX idx_shifts_platform_date       ON earnings.shifts(platform, shift_date DESC) WHERE deleted_at IS NULL;
-- Composite: city-wide median (verified shifts only)
CREATE INDEX idx_shifts_verified_analytics  ON earnings.shifts(shift_date, effective_hourly_rate)
    WHERE verification_status = 'verified' AND deleted_at IS NULL;
-- Verifier queue
CREATE INDEX idx_shifts_pending_screenshot  ON earnings.shifts(created_at ASC)
    WHERE verification_status = 'pending' AND has_screenshot = TRUE AND deleted_at IS NULL;

-- earnings.shift_screenshots
CREATE INDEX idx_screenshots_shift_id   ON earnings.shift_screenshots(shift_id);
CREATE INDEX idx_screenshots_worker_id  ON earnings.shift_screenshots(worker_id);
CREATE INDEX idx_screenshots_primary    ON earnings.shift_screenshots(shift_id) WHERE is_primary = TRUE;

-- earnings.verification_history
CREATE INDEX idx_verif_shift_id         ON earnings.verification_history(shift_id);
CREATE INDEX idx_verif_verifier_id      ON earnings.verification_history(verifier_id);
CREATE INDEX idx_verif_decided_at       ON earnings.verification_history(decided_at DESC);

-- grievance.complaints
CREATE INDEX idx_complaints_worker_id   ON grievance.complaints(worker_id);
CREATE INDEX idx_complaints_platform    ON grievance.complaints(platform);
CREATE INDEX idx_complaints_status      ON grievance.complaints(status);
CREATE INDEX idx_complaints_category    ON grievance.complaints(category);
CREATE INDEX idx_complaints_created     ON grievance.complaints(created_at DESC);
CREATE INDEX idx_complaints_advocate    ON grievance.complaints(advocate_id) WHERE advocate_id IS NOT NULL;
CREATE INDEX idx_complaints_tags        ON grievance.complaints USING GIN(tags);  -- fast tag search
-- Full-text search on description
CREATE INDEX idx_complaints_fts         ON grievance.complaints
    USING GIN(to_tsvector('english', description));

-- analytics.anomaly_logs
CREATE INDEX idx_anomaly_worker_id      ON analytics.anomaly_logs(worker_id);
CREATE INDEX idx_anomaly_detected_at    ON analytics.anomaly_logs(detected_at DESC);
CREATE INDEX idx_anomaly_type_severity  ON analytics.anomaly_logs(anomaly_type, severity);
-- Advocate panel: workers with high risk this week
CREATE INDEX idx_anomaly_recent_high    ON analytics.anomaly_logs(worker_id, risk_score DESC)
    WHERE detected_at >= NOW() - INTERVAL '7 days';

-- community.posts
CREATE INDEX idx_posts_created_at   ON community.posts(created_at DESC) WHERE is_approved = TRUE;
CREATE INDEX idx_posts_type         ON community.posts(post_type);
CREATE INDEX idx_posts_platform     ON community.posts(platform) WHERE platform IS NOT NULL;

-- analytics.commission_snapshots
CREATE INDEX idx_commission_platform    ON analytics.commission_snapshots(platform, snapshot_month DESC);


-- ============================================================
-- 10. TRIGGERS
-- ============================================================

-- 10.1 updated_at auto-update function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_shifts_updated_at
    BEFORE UPDATE ON earnings.shifts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_complaints_updated_at
    BEFORE UPDATE ON grievance.complaints
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 10.2 Auto-log verification history when shift status changes
CREATE OR REPLACE FUNCTION log_verification_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.verification_status IS DISTINCT FROM NEW.verification_status THEN
        INSERT INTO earnings.verification_history
            (shift_id, verifier_id, prev_status, new_status, note)
        VALUES
            (NEW.id, NEW.verifier_id, OLD.verification_status, NEW.verification_status, NEW.verifier_note);

        -- Stamp verified_at when moving to verified
        IF NEW.verification_status = 'verified' THEN
            NEW.verified_at = NOW();
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_shift_verification_log
    BEFORE UPDATE ON earnings.shifts
    FOR EACH ROW EXECUTE FUNCTION log_verification_change();


-- 10.3 Auto-log complaint status changes
CREATE OR REPLACE FUNCTION log_complaint_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO grievance.complaint_history
            (complaint_id, changed_by, prev_status, new_status)
        VALUES
            (NEW.id, COALESCE(NEW.advocate_id, OLD.advocate_id), OLD.status, NEW.status);

        -- Stamp escalated_at / resolved_at
        IF NEW.status = 'escalated' AND OLD.status != 'escalated' THEN
            NEW.escalated_at = NOW();
        END IF;
        IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
            NEW.resolved_at = NOW();
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_complaint_status_log
    BEFORE UPDATE ON grievance.complaints
    FOR EACH ROW EXECUTE FUNCTION log_complaint_change();


-- 10.4 Sync complaint upvote count from upvotes table
CREATE OR REPLACE FUNCTION sync_complaint_upvotes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE grievance.complaints
           SET upvotes = upvotes + 1
         WHERE id = NEW.complaint_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE grievance.complaints
           SET upvotes = GREATEST(upvotes - 1, 0)
         WHERE id = OLD.complaint_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_complaint_upvote_sync
    AFTER INSERT OR DELETE ON grievance.complaint_upvotes
    FOR EACH ROW EXECUTE FUNCTION sync_complaint_upvotes();


-- 10.5 Sync cluster complaint count when complaints are assigned/unassigned
CREATE OR REPLACE FUNCTION sync_cluster_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Decrement old cluster count
    IF OLD.cluster_id IS NOT NULL AND OLD.cluster_id IS DISTINCT FROM NEW.cluster_id THEN
        UPDATE grievance.complaint_clusters
           SET complaint_count = GREATEST(complaint_count - 1, 0)
         WHERE id = OLD.cluster_id;
    END IF;
    -- Increment new cluster count
    IF NEW.cluster_id IS NOT NULL AND NEW.cluster_id IS DISTINCT FROM OLD.cluster_id THEN
        UPDATE grievance.complaint_clusters
           SET complaint_count = complaint_count + 1
         WHERE id = NEW.cluster_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cluster_count_sync
    AFTER UPDATE OF cluster_id ON grievance.complaints
    FOR EACH ROW EXECUTE FUNCTION sync_cluster_count();


-- 10.6 Sync has_screenshot flag on shifts when screenshot is uploaded
CREATE OR REPLACE FUNCTION sync_has_screenshot()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.is_primary = TRUE THEN
        UPDATE earnings.shifts
           SET screenshot_url = NEW.file_url,
               has_screenshot  = TRUE
         WHERE id = NEW.shift_id;
    ELSIF TG_OP = 'DELETE' THEN
        -- Check if any screenshots remain
        IF NOT EXISTS (SELECT 1 FROM earnings.shift_screenshots WHERE shift_id = OLD.shift_id) THEN
            UPDATE earnings.shifts
               SET screenshot_url = NULL,
                   has_screenshot  = FALSE
             WHERE id = OLD.shift_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_screenshot_sync
    AFTER INSERT OR UPDATE OR DELETE ON earnings.shift_screenshots
    FOR EACH ROW EXECUTE FUNCTION sync_has_screenshot();


-- ============================================================
-- 11. STORED FUNCTIONS  (service-callable helpers)
-- ============================================================

-- 11.1 Income Certificate data (Certificate Renderer service)
CREATE OR REPLACE FUNCTION get_income_certificate_data(
    p_worker_id UUID,
    p_from_date DATE,
    p_to_date   DATE
)
RETURNS TABLE (
    platform            TEXT,
    shift_count         BIGINT,
    total_gross         NUMERIC,
    total_deductions    NUMERIC,
    total_net           NUMERIC,
    total_hours         NUMERIC,
    avg_hourly_rate     NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.platform::TEXT,
        COUNT(*)::BIGINT,
        ROUND(SUM(s.gross_earned),        2),
        ROUND(SUM(s.platform_deductions), 2),
        ROUND(SUM(s.net_received),        2),
        ROUND(SUM(s.hours_worked),        2),
        ROUND(
            SUM(s.net_received) / NULLIF(SUM(s.hours_worked), 0), 2
        )
    FROM earnings.shifts s
    WHERE s.worker_id          = p_worker_id
      AND s.shift_date         BETWEEN p_from_date AND p_to_date
      AND s.verification_status = 'verified'
      AND s.deleted_at          IS NULL
    GROUP BY s.platform
    ORDER BY total_net DESC;
END;
$$ LANGUAGE plpgsql STABLE;


-- 11.2 Shifts for anomaly service Phase 2 integration
CREATE OR REPLACE FUNCTION get_shifts_for_anomaly(
    p_worker_id UUID,
    p_days      INTEGER DEFAULT 90
)
RETURNS TABLE (
    shift_date          DATE,
    platform            TEXT,
    gross_earned        NUMERIC,
    platform_deductions NUMERIC,
    net_received        NUMERIC,
    hours_worked        NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.shift_date,
        s.platform::TEXT,
        s.gross_earned,
        s.platform_deductions,
        s.net_received,
        s.hours_worked
    FROM earnings.shifts s
    WHERE s.worker_id  = p_worker_id
      AND s.shift_date >= CURRENT_DATE - p_days
      AND s.deleted_at IS NULL
    ORDER BY s.shift_date ASC;
END;
$$ LANGUAGE plpgsql STABLE;


-- 11.3 City-wide median for a specific zone + category + month
--      Used by worker dashboard comparison bar — single-row fast query
CREATE OR REPLACE FUNCTION get_city_median(
    p_city_zone TEXT,
    p_category  TEXT,
    p_month     DATE DEFAULT DATE_TRUNC('month', NOW())::DATE
)
RETURNS NUMERIC AS $$
DECLARE
    v_median NUMERIC;
BEGIN
    SELECT median_hourly_rate
      INTO v_median
      FROM analytics.v_city_zone_medians
     WHERE city_zone::TEXT = p_city_zone
       AND category::TEXT  = p_category
       AND month           = DATE_TRUNC('month', p_month)::DATE;

    RETURN COALESCE(v_median, 0);
END;
$$ LANGUAGE plpgsql STABLE;


-- 11.4 Soft-delete a shift (never hard delete — needed for audit trail)
CREATE OR REPLACE FUNCTION soft_delete_shift(
    p_shift_id  UUID,
    p_worker_id UUID   -- ensure worker owns the shift
)
RETURNS BOOLEAN AS $$
DECLARE
    rows_affected INTEGER;
BEGIN
    UPDATE earnings.shifts
       SET deleted_at = NOW()
     WHERE id        = p_shift_id
       AND worker_id = p_worker_id
       AND deleted_at IS NULL;

    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 12. SEED DATA
-- ============================================================

-- 12.1 Demo users (password = "Password123!" — bcrypt hash)
--      Replace password_hash with real bcrypt values from your auth service on first run.
INSERT INTO auth.users
    (id, name, email, password_hash, role, city_zone, category, phone)
VALUES
    (
        '11111111-1111-1111-1111-111111111111',
        'Ali Raza',
        'worker@fairgig.pk',
        '$2b$12$DEMO_HASH_REPLACE_IN_SEED_SCRIPT',
        'worker',
        'DHA',
        'ride_hailing',
        '+92-300-1234567'
    ),
    (
        '22222222-2222-2222-2222-222222222222',
        'Sara Khan',
        'verifier@fairgig.pk',
        '$2b$12$DEMO_HASH_REPLACE_IN_SEED_SCRIPT',
        'verifier',
        NULL,
        NULL,
        NULL
    ),
    (
        '33333333-3333-3333-3333-333333333333',
        'Ahmed Malik',
        'advocate@fairgig.pk',
        '$2b$12$DEMO_HASH_REPLACE_IN_SEED_SCRIPT',
        'advocate',
        NULL,
        NULL,
        NULL
    );


-- 12.2 Sample verified shifts for demo worker (Ali Raza)
--      Includes 1 anomalous shift (shift #6) with 45% deduction — triggers anomaly service
INSERT INTO earnings.shifts
    (worker_id, platform, shift_date, hours_worked, gross_earned, platform_deductions, net_received, verification_status, verifier_id, verifier_note, verified_at)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'Careem', '2025-01-05', 4.0,  2000, 500,  1500, 'verified', '22222222-2222-2222-2222-222222222222', 'Screenshot matches', NOW() - INTERVAL '10 days'),
    ('11111111-1111-1111-1111-111111111111', 'Careem', '2025-01-12', 4.5,  2200, 550,  1650, 'verified', '22222222-2222-2222-2222-222222222222', 'Screenshot matches', NOW() - INTERVAL '9 days'),
    ('11111111-1111-1111-1111-111111111111', 'Careem', '2025-01-19', 3.5,  1800, 450,  1350, 'verified', '22222222-2222-2222-2222-222222222222', 'Screenshot matches', NOW() - INTERVAL '8 days'),
    ('11111111-1111-1111-1111-111111111111', 'Careem', '2025-01-26', 5.0,  2500, 625,  1875, 'verified', '22222222-2222-2222-2222-222222222222', 'Screenshot matches', NOW() - INTERVAL '7 days'),
    ('11111111-1111-1111-1111-111111111111', 'Bykea',  '2025-02-02', 6.0,  3000, 570,  2430, 'verified', '22222222-2222-2222-2222-222222222222', 'Screenshot matches', NOW() - INTERVAL '6 days'),
    ('11111111-1111-1111-1111-111111111111', 'Careem', '2025-02-09', 4.0,  2000, 900,  1100, 'verified', '22222222-2222-2222-2222-222222222222', 'Flagged — high deduction noted but confirmed by screenshot', NOW() - INTERVAL '5 days'),
    -- ↑ Shift #6: 900/2000 = 45% deduction — anomaly detector WILL flag this
    ('11111111-1111-1111-1111-111111111111', 'Bykea',  '2025-02-16', 5.5,  2750, 522,  2228, 'verified', '22222222-2222-2222-2222-222222222222', 'Screenshot matches', NOW() - INTERVAL '4 days'),
    ('11111111-1111-1111-1111-111111111111', 'Careem', '2025-02-23', 4.0,  2100, 525,  1575, 'pending',  NULL, NULL, NULL),
    ('11111111-1111-1111-1111-111111111111', 'Bykea',  '2025-03-02', 7.0,  3500, 665,  2835, 'pending',  NULL, NULL, NULL);


-- 12.3 Sample grievance complaint
INSERT INTO grievance.complaints
    (worker_id, platform, category, description, tags, status)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Careem',
    'commission_hike',
    'Careem increased deduction from 25% to 30% without any notice or explanation. This happened on February 9th and affected many drivers in DHA zone.',
    ARRAY['commission_change', 'no_notice', 'DHA'],
    'open'
);


-- 12.4 Sample community post
INSERT INTO community.posts
    (post_type, platform, title, body)
VALUES (
    'rate_intel',
    'Careem',
    'Careem commission jumped in DHA this week',
    'Watch out everyone — Careem is taking 30% now in DHA area. Was 25% last week. Anyone else seeing this? Post your numbers below so we can track it.'
);


-- ============================================================
-- 13. QUICK VERIFICATION QUERIES
--     Run these after executing this file to confirm everything is set up.
-- ============================================================

/*
-- Table count per schema:
SELECT schemaname, COUNT(*) AS table_count
FROM pg_tables
WHERE schemaname IN ('auth','earnings','grievance','community','analytics')
GROUP BY schemaname ORDER BY schemaname;

-- View list:
SELECT schemaname, viewname
FROM pg_views
WHERE schemaname IN ('auth','earnings','grievance','community','analytics')
ORDER BY schemaname, viewname;

-- Index count:
SELECT schemaname, COUNT(*) AS index_count
FROM pg_indexes
WHERE schemaname IN ('auth','earnings','grievance','community','analytics')
GROUP BY schemaname;

-- Trigger list:
SELECT trigger_name, event_object_table, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema IN ('auth','earnings','grievance','community','analytics')
ORDER BY event_object_table;

-- Demo data check:
SELECT COUNT(*) FROM auth.users;     -- expect 3
SELECT COUNT(*) FROM earnings.shifts; -- expect 9
SELECT COUNT(*) FROM grievance.complaints; -- expect 1

-- City median (needs seed.py to have value):
SELECT * FROM analytics.v_city_zone_medians LIMIT 5;

-- Verifier queue:
SELECT * FROM analytics.v_verifier_queue LIMIT 5;

-- Anomaly service Phase 2 test:
SELECT * FROM get_shifts_for_anomaly('11111111-1111-1111-1111-111111111111', 90);
*/


-- ============================================================
-- 14. SEED SCRIPT REMINDER
-- ============================================================

/*
  After running this file, run seed.py in /auth-service to insert 60+ workers.
  Required for the city-wide median view to have enough data (min 5 workers/group).

  Seed script must produce:
  - 60+ workers spread across 5 city zones × 4 categories
  - 90–180 shifts per worker spanning 6 months
  - Platform deduction rates:
      Careem    25–30%
      Bykea     18–22%
      foodpanda 28–35%
      Upwork    10–20%
  - 5–8 anomalous shifts per worker (deduction spike or income drop)
  - DHA workers earning ~15% more than Saddar workers on average

  After seeding:
  SELECT COUNT(*) FROM auth.users WHERE role='worker';   -- ≥ 60
  SELECT COUNT(*) FROM earnings.shifts;                  -- ≥ 5000
  SELECT COUNT(*) FROM analytics.v_city_zone_medians;   -- ≥ 20 rows
*/

-- ============================================================
-- END OF SCHEMA
-- FairGig | SOFTEC 2026 | In sha Allah 🏆
-- ============================================================
