/**
 * Shared email-verification / password-reset senders.
 * Extracted from index.ts so adminRoutes.ts can trigger the same flows
 * on a user's behalf (resend verification, send reset OTP).
 */
import { generateId, generateOTP, generateToken } from './crypto';
import { sendEmail, emailVerifyTemplate, passwordResetOTPTemplate } from './email';
import type { Bindings } from './types';

export async function sendVerificationEmail(env: Bindings, userId: string, email: string, name: string | null) {
  const token = generateToken(32);
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24h

  await env.DB.prepare(`
    INSERT INTO email_verifications (id, user_id, email, token, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(generateId(), userId, email, token, expiresAt, Date.now()).run();

  const origin = env.WEB_URL || 'https://businessaios-web.pskspace.workers.dev';
  const verifyUrl = `${origin}/verify-email?token=${token}`;

  await sendEmail(env, {
    to: email,
    ...emailVerifyTemplate({ name: name || undefined, verifyUrl }),
    template: 'email_verify',
  });
}

export async function sendPasswordResetOTP(env: Bindings, userId: string, email: string, name: string | null) {
  const otp = generateOTP();
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 min

  await env.DB.prepare(`
    INSERT INTO otp_codes (id, user_id, purpose, code, expires_at, created_at)
    VALUES (?, ?, 'password_reset', ?, ?, ?)
  `).bind(generateId(), userId, otp, expiresAt, Date.now()).run();

  await sendEmail(env, {
    to: email,
    ...passwordResetOTPTemplate({ name: name || undefined, otp, expiresInMinutes: 15 }),
    template: 'password_reset',
  });
}
