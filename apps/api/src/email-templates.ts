/**
 * Email Templates
 * HTML emails sent via Resend
 */

export const waitlistConfirmationTH = (email: string, position: number) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ยินดีต้อนรับสู่ BusinessAiOs</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 40px 0;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 40px;">
    <h1 style="color: #0a0a0a; font-size: 28px; margin: 0 0 8px;">ยินดีต้อนรับ 🎉</h1>
    <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
      คุณอยู่ในลำดับที่ <strong style="color: #3b82f6;">#${position}</strong> ของ waitlist
    </p>
    <p style="color: #0a0a0a; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
      ขอบคุณที่สนใจ <strong>BusinessAiOs</strong> — ระบบช่วยสร้าง marketing system ครบชุดด้วย AI
    </p>
    <p style="color: #0a0a0a; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
      เราจะแจ้งให้คุณทราบทันทีที่เปิดให้ใช้งาน
    </p>
    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;">
    <p style="color: #999; font-size: 12px; margin: 0;">
      หากมีคำถาม ตอบกลับอีเมลนี้ได้เลย
    </p>
  </div>
</body>
</html>
`;

export const waitlistConfirmationEN = (email: string, position: number) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Welcome to BusinessAiOs</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 40px 0;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 40px;">
    <h1 style="color: #0a0a0a; font-size: 28px; margin: 0 0 8px;">Welcome 🎉</h1>
    <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
      You are #<strong style="color: #3b82f6;">${position}</strong> on the waitlist
    </p>
    <p style="color: #0a0a0a; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
      Thanks for your interest in <strong>BusinessAiOs</strong> — the AI-powered marketing system builder
    </p>
    <p style="color: #0a0a0a; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
      We will notify you as soon as we launch.
    </p>
    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;">
    <p style="color: #999; font-size: 12px; margin: 0;">
      If you have any questions, just reply to this email.
    </p>
  </div>
</body>
</html>
`;
