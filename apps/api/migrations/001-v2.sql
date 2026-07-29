-- Migration 001: v2 schema additions
-- Adds: profile fields, email verify, 2FA, credits, BYOK, saved tool runs

-- =====================================================
-- USERS: extend for profile + roles + credits
-- =====================================================
ALTER TABLE users ADD COLUMN first_name TEXT;
ALTER TABLE users ADD COLUMN last_name TEXT;
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';
ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN email_verified_at INTEGER;
ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 100;
ALTER TABLE users ADD COLUMN totp_secret TEXT;

-- Index for admin lookups
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- =====================================================
-- API KEYS (BYOK) — encrypted at rest
-- =====================================================
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  key_hint TEXT,
  label TEXT,
  is_active INTEGER DEFAULT 1,
  last_used_at INTEGER,
  created_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_provider ON api_keys(user_id, provider);

-- =====================================================
-- EMAIL VERIFICATIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS email_verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used INTEGER DEFAULT 0,
  created_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id);

-- =====================================================
-- OTP CODES (2FA + password reset)
-- =====================================================
CREATE TABLE IF NOT EXISTS otp_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  purpose TEXT NOT NULL,  -- 'login_2fa' | 'password_reset' | 'email_verify'
  code TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER DEFAULT 0,
  created_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_user ON otp_codes(user_id, purpose);
CREATE INDEX IF NOT EXISTS idx_otp_codes_code ON otp_codes(code);

-- =====================================================
-- CREDIT TRANSACTIONS (audit trail)
-- =====================================================
CREATE TABLE IF NOT EXISTS credit_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  delta INTEGER NOT NULL,  -- +/-
  reason TEXT NOT NULL,  -- 'admin_grant' | 'signup_bonus' | 'generation' | 'refund' | 'admin_deduct'
  reference_id TEXT,
  balance_after INTEGER,
  note TEXT,
  created_by TEXT,
  created_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id, created_at DESC);

-- =====================================================
-- SAVED TOOL RUNS (per-user library)
-- =====================================================
CREATE TABLE IF NOT EXISTS tool_saves (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tool_type TEXT NOT NULL,  -- 'pain_generator' | 'brand_voice' | 'persona_builder'
  title TEXT,
  input JSON,
  output JSON,
  archived INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tool_saves_user ON tool_saves(user_id, archived, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_saves_type ON tool_saves(user_id, tool_type);

-- =====================================================
-- EMAIL OUTBOX (mock mode — store instead of send)
-- =====================================================
CREATE TABLE IF NOT EXISTS email_outbox (
  id TEXT PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  template TEXT,
  status TEXT DEFAULT 'queued',  -- 'queued' | 'sent' | 'failed'
  error TEXT,
  sent_at INTEGER,
  created_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_status ON email_outbox(status, created_at);

-- =====================================================
-- ADMIN ACTIONS (audit log)
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_actions (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_user_id TEXT,
  details JSON,
  created_at INTEGER,
  FOREIGN KEY (admin_id) REFERENCES users(id),
  FOREIGN KEY (target_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON admin_actions(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON admin_actions(target_user_id);

-- =====================================================
-- RATE LIMITS (1-min buckets)
-- =====================================================
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL,
  expires_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);

-- Auto-cleanup trigger-style: app code deletes expired rows periodically.
