-- Payments table for Stripe PromptPay top-ups
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  package_id TEXT NOT NULL,
  credits INTEGER NOT NULL,
  amount_satang INTEGER NOT NULL,
  payment_intent_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | succeeded | failed | refunded
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_intent ON payments(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
