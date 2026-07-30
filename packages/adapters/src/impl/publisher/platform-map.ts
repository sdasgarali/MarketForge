/**
 * Platform-name mapping between MarketForge's canonical `Platform` enum and
 * Ayrshare's platform identifiers. Ayrshare uses `twitter` (not `x`) and lower-
 * case names. Kept as a pure module so the mapping is unit-tested in isolation.
 */
import type { Platform } from '@marketforge/contracts';

/** MarketForge Platform → Ayrshare platform string. */
export const PLATFORM_TO_AYRSHARE: Record<Platform, string> = {
  x: 'twitter',
  instagram: 'instagram',
  facebook: 'facebook',
  linkedin: 'linkedin',
  youtube: 'youtube',
  tiktok: 'tiktok',
};

/** Reverse map: Ayrshare platform string → MarketForge Platform. */
export const AYRSHARE_TO_PLATFORM: Record<string, Platform> = Object.fromEntries(
  Object.entries(PLATFORM_TO_AYRSHARE).map(([k, v]) => [v, k as Platform]),
) as Record<string, Platform>;

export function toAyrsharePlatform(p: Platform): string {
  const mapped = PLATFORM_TO_AYRSHARE[p];
  if (!mapped) throw new Error(`Unsupported platform for Ayrshare: ${p}`);
  return mapped;
}

export function toAyrsharePlatforms(platforms: Platform[]): string[] {
  return platforms.map(toAyrsharePlatform);
}

/** Map an Ayrshare platform string back to a canonical Platform (or undefined). */
export function fromAyrsharePlatform(name: string): Platform | undefined {
  return AYRSHARE_TO_PLATFORM[name.toLowerCase()];
}

/** Platforms that require at least one media item (Ayrshare/platform rules). */
export const MEDIA_REQUIRED: ReadonlySet<Platform> = new Set<Platform>([
  'instagram',
  'youtube',
  'tiktok',
]);

/** Platforms that require VIDEO specifically. */
export const VIDEO_REQUIRED: ReadonlySet<Platform> = new Set<Platform>(['youtube', 'tiktok']);
