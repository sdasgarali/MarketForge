/**
 * Global emergency kill switch. A single Redis flag that (a) the API sets when
 * the operator hits "Force Shutdown", and (b) the worker checks at the start of
 * every job so in-flight pickups abort immediately. Combined with pausing +
 * obliterating the queues, this force-stops all pipeline processing.
 */
import { connection } from './connection.js';

const KILL_KEY = 'marketforge:killswitch';

export interface KillSwitchStatus {
  engaged: boolean;
  at?: string;
  reason?: string;
  by?: string;
}

/** Engage the kill switch (persisted until explicitly cleared). */
export async function engageKillSwitch(
  meta: { reason?: string; by?: string } = {},
): Promise<void> {
  await connection.set(
    KILL_KEY,
    JSON.stringify({
      at: new Date().toISOString(),
      reason: meta.reason ?? 'manual force shutdown',
      by: meta.by ?? 'unknown',
    }),
  );
}

/** Clear the kill switch (re-enables processing). */
export async function clearKillSwitch(): Promise<void> {
  await connection.del(KILL_KEY);
}

/** Fast boolean check (used by the worker on every job). */
export async function isKillSwitchEngaged(): Promise<boolean> {
  return (await connection.exists(KILL_KEY)) === 1;
}

/** Full status for the monitor UI. */
export async function killSwitchStatus(): Promise<KillSwitchStatus> {
  const raw = await connection.get(KILL_KEY);
  if (!raw) return { engaged: false };
  try {
    return { engaged: true, ...(JSON.parse(raw) as Record<string, string>) };
  } catch {
    return { engaged: true };
  }
}
