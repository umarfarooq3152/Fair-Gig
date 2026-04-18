CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS earnings;
CREATE SCHEMA IF NOT EXISTS grievance;
CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('worker', 'verifier', 'advocate')),
  city_zone VARCHAR(50),
  category VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS earnings.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID REFERENCES auth.users(id),
  platform VARCHAR(50),
  shift_date DATE NOT NULL,
  hours_worked NUMERIC(4,2),
  gross_earned NUMERIC(10,2),
  platform_deductions NUMERIC(10,2),
  net_received NUMERIC(10,2),
  screenshot_url TEXT,
  verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'flagged', 'unverifiable')),
  verifier_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grievance.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID REFERENCES auth.users(id),
  platform VARCHAR(50),
  category VARCHAR(80),
  description TEXT,
  tags TEXT[],
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'escalated', 'resolved')),
  advocate_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
