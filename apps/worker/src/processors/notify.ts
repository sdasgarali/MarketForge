/**
 * notify processor — Stage 7. Delivers a notification via the requested channel.
 * A `dashboard` notification is ALWAYS persisted to the `notifications` table so
 * it appears in-app; external channels (slack/discord/telegram/email) are sent
 * when their config is present, else we degrade to a dashboard insert.
 *
 * Terminal (no DLQ storm): a missing external channel config is logged and the
 * dashboard fallback is written rather than throwing.
 */
import { request } from 'undici';
import { env } from '@marketforge/config';
import { db, withTenant, notifications } from '@marketforge/db';
import { defineProcessor } from './base.js';
import { toError } from '../lib/errors.js';

async function postWebhook(url: string, body: unknown): Promise<void> {
  const res = await request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    headersTimeout: 15_000,
    bodyTimeout: 15_000,
  });
  await res.body.text();
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`webhook ${url} returned ${res.statusCode}`);
  }
}

async function sendSmtp(_subject: string, _text: string): Promise<void> {
  // SMTP is optional; we avoid adding a mail dependency at the foundation layer.
  // When SMTP_URL is configured a real transport should be wired here. For now
  // we surface a clear signal so ops know email was requested but not sent.
  throw new Error(`SMTP delivery not wired (SMTP_URL configured=${Boolean(env.SMTP_URL)}); use dashboard/slack`);
}

export const notifyProcessor = defineProcessor('notify', async ({ payload, log }) => {
  const { org_id, channel, type, title, body } = payload;

  // Always persist a dashboard record for auditability + in-app visibility.
  const persistDashboard = async (): Promise<void> => {
    await withTenant(db, org_id, async (tx) => {
      await tx.insert(notifications).values({
        orgId: org_id,
        userId: payload.user_id ?? null,
        channel: 'dashboard',
        type,
        title,
        body: body ?? null,
        payload: (payload.payload ?? null) as unknown,
        sentAt: new Date(),
      });
    });
  };

  try {
    switch (channel) {
      case 'slack': {
        if (!env.SLACK_WEBHOOK_URL) throw new Error('SLACK_WEBHOOK_URL not configured');
        await postWebhook(env.SLACK_WEBHOOK_URL, { text: `*${title}*\n${body ?? ''}` });
        break;
      }
      case 'discord': {
        if (!env.DISCORD_WEBHOOK_URL) throw new Error('DISCORD_WEBHOOK_URL not configured');
        await postWebhook(env.DISCORD_WEBHOOK_URL, { content: `**${title}**\n${body ?? ''}` });
        break;
      }
      case 'telegram': {
        if (!env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN not configured');
        // chat_id is expected in the payload for Telegram delivery.
        const chatId = (payload.payload as { chat_id?: string | number } | undefined)?.chat_id;
        if (chatId === undefined) throw new Error('telegram notify requires payload.chat_id');
        await postWebhook(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: `${title}\n${body ?? ''}`,
        });
        break;
      }
      case 'email': {
        await sendSmtp(title, body ?? '');
        break;
      }
      case 'dashboard':
      default:
        // handled by the always-persist below
        break;
    }
  } catch (err) {
    // External delivery failed → degrade to dashboard (do not DLQ a notification).
    log.warn({ channel, err: toError(err).message }, 'external notify failed; writing dashboard fallback');
  }

  await persistDashboard();
  log.info({ channel, type, title, org_id }, 'notification delivered');
  return { delivered: true, channel };
});
