import { sendEmail } from '../email';
import type { Bindings } from '../types';
import { refundMediaHold } from './credits';
import { markGenerationFailed } from './generations';

const NON_TERMINAL_STATUSES = ['queued', 'submitting', 'processing', 'delivery_pending', 'cancel_requested'];
const SWEEP_BATCH_SIZE = 25;
const ALERT_THROTTLE_MS = 60 * 60 * 1000; // at most one stuck-job email per hour

/**
 * Refunds generations that blew past their delivery deadline without ever
 * completing — closes the gap where `delivery_deadline_at` was stored on
 * every generation but nothing actually enforced it (a stuck job could hold
 * a user's credits forever). Also alerts ops (throttled) when work items hit
 * dead_letter, since those need a human to look at the underlying failure.
 */
export async function reconcileStuckGenerations(env: Bindings, now = Date.now()) {
  const expired = await refundExpiredGenerations(env, now);
  const deadLetters = await countDeadLetterWorkItems(env);
  let alerted = false;
  if (deadLetters > 0 || expired > 0) {
    alerted = await maybeSendStuckJobAlert(env, { expired, deadLetters }, now);
  }
  return { expired, deadLetters, alerted };
}

async function refundExpiredGenerations(env: Bindings, now: number) {
  const placeholders = NON_TERMINAL_STATUSES.map(() => '?').join(', ');
  const due = await env.DB.prepare(`
    SELECT id FROM media_generations
    WHERE status IN (${placeholders}) AND delivery_deadline_at IS NOT NULL AND delivery_deadline_at <= ?
    ORDER BY delivery_deadline_at ASC LIMIT ?
  `).bind(...NON_TERMINAL_STATUSES, now, SWEEP_BATCH_SIZE).all<{ id: string }>();

  let refunded = 0;
  for (const row of due.results || []) {
    // Refund BEFORE marking the generation failed. refundMediaHold is
    // idempotent (checks hold.status), but markGenerationFailed's terminal
    // 'failed' status takes the generation out of NON_TERMINAL_STATUSES —
    // once that write lands, this row is never selected by this query again.
    // If we crash/throw between the two calls, doing the refund first means
    // the generation is still non-terminal on the next tick, so it gets
    // picked up again and the (idempotent) refund + failure-marking both
    // complete. Marking-failed-first would instead orphan the hold forever,
    // since the row would silently drop out of this query's WHERE clause.
    const result = await refundMediaHold(env, row.id, 'delivery_deadline_exceeded', now);
    await markGenerationFailed(
      env,
      row.id,
      'delivery_deadline_exceeded',
      'Generation did not complete within its delivery deadline.',
      now,
    );
    if (result.ok) refunded += 1;
  }
  return refunded;
}

async function countDeadLetterWorkItems(env: Bindings) {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM media_work_items WHERE status = 'dead_letter'",
  ).first<{ count: number }>();
  return row?.count || 0;
}

async function maybeSendStuckJobAlert(
  env: Bindings,
  summary: { expired: number; deadLetters: number },
  now: number,
) {
  const throttleKey = 'alert:media_stuck_jobs';
  const existing = await env.DB.prepare('SELECT expires_at FROM rate_limits WHERE key = ?')
    .bind(throttleKey).first<{ expires_at: number }>();
  if (existing && existing.expires_at > now) return false; // already alerted recently

  if (env.NOTIFY_EMAIL) {
    await sendEmail(env, {
      to: env.NOTIFY_EMAIL,
      subject: `[Creative Studio] Stuck jobs need attention`,
      html: `
        <p>The scheduled reconciler just ran and found:</p>
        <ul>
          <li>${summary.expired} generation(s) refunded for exceeding their delivery deadline</li>
          <li>${summary.deadLetters} work item(s) sitting in dead_letter</li>
        </ul>
        <p>Check <code>/admin/creative</code> for details.</p>
      `,
    });
  }

  await env.DB.prepare(`
    INSERT INTO rate_limits (key, value, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET value = value + 1, expires_at = excluded.expires_at
  `).bind(throttleKey, now + ALERT_THROTTLE_MS).run();

  return true;
}
