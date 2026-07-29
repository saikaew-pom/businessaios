/**
 * Email service — Brevo (with mock mode for dev)
 * https://www.brevo.com/ — transactional email API
 *
 * Modes:
 *  - Production: set BREVO_API_KEY → sends via Brevo HTTP API
 *  - Mock: no BREVO_API_KEY → stores in `email_outbox` table, returns the rendered content
 *
 * This makes local dev work without an API key, while production is one env var away.
 */

import { generateId } from './crypto';
import type { Bindings } from './types';

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  template?: string;
};

export type EmailResult = {
  ok: boolean;
  messageId?: string;
  preview?: string;  // URL or text to view in mock mode
  error?: string;
  mock?: boolean;
};

/**
 * Send an email via Brevo, or queue to outbox in mock mode.
 */
export async function sendEmail(env: Bindings, payload: EmailPayload): Promise<EmailResult> {
  const apiKey = (env as any).BREVO_API_KEY;

  if (!apiKey) {
    return queueMockEmail(env, payload);
  }

  // Real Brevo API
  try {
    const fromEmail = (env as any).BREVO_FROM_EMAIL || 'noreply@businessaios.com';
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'BusinessAiOs', email: fromEmail },
        to: [{ email: payload.to }],
        subject: payload.subject,
        htmlContent: payload.html,
        textContent: payload.text || stripHtml(payload.html),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Brevo] send failed:', res.status, errText);
      return { ok: false, error: `Brevo ${res.status}: ${errText.slice(0, 200)}` };
    }

    const data = await res.json() as { messageId?: string };
    console.log(`[Brevo] sent → ${payload.to}: ${payload.subject} (messageId: ${data.messageId}, from: ${fromEmail})`);

    // Also log to outbox for audit trail
    try {
      const id = generateId();
      await env.DB.prepare(`
        INSERT INTO email_outbox (id, to_email, subject, body_html, body_text, template, status, sent_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'sent', ?, ?)
      `).bind(
        id,
        payload.to,
        payload.subject,
        payload.html,
        payload.text || stripHtml(payload.html),
        payload.template || null,
        Date.now(),
        Date.now()
      ).run();
    } catch (logErr: any) {
      console.error('[Brevo] outbox log failed:', logErr.message);
    }

    return { ok: true, messageId: data.messageId };
  } catch (err: any) {
    console.error('[Brevo] error:', err);
    return { ok: false, error: err.message };
  }
}

/**
 * Mock: store email in outbox for inspection.
 */
async function queueMockEmail(env: Bindings, payload: EmailPayload): Promise<EmailResult> {
  const id = generateId();
  try {
    await env.DB.prepare(`
      INSERT INTO email_outbox (id, to_email, subject, body_html, body_text, template, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'queued', ?)
    `).bind(
      id,
      payload.to,
      payload.subject,
      payload.html,
      payload.text || stripHtml(payload.html),
      payload.template || null,
      Date.now()
    ).run();
    console.log(`[Email-MOCK] → ${payload.to}: ${payload.subject} (id: ${id})`);
    return { ok: true, mock: true, messageId: id, preview: `/api/admin/emails/${id}` };
  } catch (err: any) {
    console.error('[Email-MOCK] queue failed:', err);
    return { ok: false, error: err.message, mock: true };
  }
}

// =====================================================
// Email Templates
// =====================================================

const baseStyle = `
  font-family: 'Noto Sans Thai', -apple-system, sans-serif;
  background: #f8fafc;
  margin: 0;
  padding: 40px 20px;
  color: #0f172a;
`;

const buttonStyle = `
  display: inline-block;
  background: #3b82f6;
  color: white;
  padding: 14px 32px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  font-size: 16px;
`;

export function emailVerifyTemplate(opts: { name?: string; verifyUrl: string }): { subject: string; html: string } {
  const subject = 'ยืนยันอีเมลของคุณ — BusinessAiOs';
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="${baseStyle}">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; background: #3b82f6; color: white; padding: 8px 16px; border-radius: 99px; font-size: 12px; font-weight: 600;">✨ MARKETING AI OS</div>
    </div>
    <h1 style="color: #0f172a; font-size: 24px; margin: 0 0 16px;">ยืนยันอีเมลของคุณ</h1>
    <p style="color: #64748b; font-size: 15px; line-height: 1.6;">สวัสดี${opts.name ? ' ' + opts.name : ''} 👋</p>
    <p style="color: #64748b; font-size: 15px; line-height: 1.6;">ขอบคุณที่สมัครใช้งาน BusinessAiOs กรุณาคลิกปุ่มด้านล่างเพื่อยืนยันอีเมลและเริ่มใช้งาน</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${opts.verifyUrl}" style="${buttonStyle}">ยืนยันอีเมล</a>
    </div>
    <p style="color: #94a3b8; font-size: 13px; line-height: 1.6;">ลิงก์นี้หมดอายุใน 24 ชั่วโมง หากคุณไม่ได้สมัคร ให้ละเลยอีเมลนี้</p>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
    <p style="color: #94a3b8; font-size: 12px; text-align: center;">BusinessAiOs · Operating System for AI Business</p>
  </div>
</body></html>`;
  return { subject, html };
}

export function passwordResetOTPTemplate(opts: { name?: string; otp: string; expiresInMinutes: number }): { subject: string; html: string } {
  const subject = 'รหัสรีเซ็ตรหัสผ่าน — BusinessAiOs';
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="${baseStyle}">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <h1 style="color: #0f172a; font-size: 24px; margin: 0 0 16px;">รีเซ็ตรหัสผ่าน</h1>
    <p style="color: #64748b; font-size: 15px; line-height: 1.6;">สวัสดี${opts.name ? ' ' + opts.name : ''}</p>
    <p style="color: #64748b; font-size: 15px; line-height: 1.6;">คุณขอรีเซ็ตรหัสผ่าน ใช้รหัส OTP นี้เพื่อยืนยัน:</p>
    <div style="text-align: center; margin: 32px 0;">
      <div style="display: inline-block; background: #f1f5f9; border: 2px dashed #cbd5e1; padding: 20px 40px; border-radius: 12px;">
        <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0f172a; font-family: monospace;">${opts.otp}</div>
      </div>
    </div>
    <p style="color: #94a3b8; font-size: 13px; text-align: center;">รหัสนี้หมดอายุใน ${opts.expiresInMinutes} นาที</p>
    <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin-top: 24px;">หากคุณไม่ได้ขอรีเซ็ต ให้ละเลยอีเมลนี้ รหัสผ่านของคุณยังปลอดภัย</p>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
    <p style="color: #94a3b8; font-size: 12px; text-align: center;">BusinessAiOs · Operating System for AI Business</p>
  </div>
</body></html>`;
  return { subject, html };
}

export function loginOTPTemplate(opts: { name?: string; otp: string; expiresInMinutes: number }): { subject: string; html: string } {
  const subject = 'รหัสยืนยันการเข้าสู่ระบบ — BusinessAiOs';
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="${baseStyle}">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <h1 style="color: #0f172a; font-size: 24px; margin: 0 0 16px;">🔐 ยืนยันการเข้าสู่ระบบ</h1>
    <p style="color: #64748b; font-size: 15px; line-height: 1.6;">สวัสดี${opts.name ? ' ' + opts.name : ''}</p>
    <p style="color: #64748b; font-size: 15px; line-height: 1.6;">คุณเปิด 2FA ไว้ ใช้รหัสนี้เพื่อเข้าสู่ระบบ:</p>
    <div style="text-align: center; margin: 32px 0;">
      <div style="display: inline-block; background: #eff6ff; border: 2px solid #3b82f6; padding: 20px 40px; border-radius: 12px;">
        <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1d4ed8; font-family: monospace;">${opts.otp}</div>
      </div>
    </div>
    <p style="color: #94a3b8; font-size: 13px; text-align: center;">รหัสนี้หมดอายุใน ${opts.expiresInMinutes} นาที</p>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
    <p style="color: #94a3b8; font-size: 12px; text-align: center;">BusinessAiOs</p>
  </div>
</body></html>`;
  return { subject, html };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
