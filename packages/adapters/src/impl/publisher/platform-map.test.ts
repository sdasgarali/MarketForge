import { describe, it, expect } from 'vitest';
import {
  toAyrsharePlatform,
  toAyrsharePlatforms,
  fromAyrsharePlatform,
  MEDIA_REQUIRED,
  VIDEO_REQUIRED,
} from './platform-map.js';

describe('Ayrshare platform-name mapping', () => {
  it('maps x → twitter', () => {
    expect(toAyrsharePlatform('x')).toBe('twitter');
  });

  it('passes through same-named platforms', () => {
    expect(toAyrsharePlatform('instagram')).toBe('instagram');
    expect(toAyrsharePlatform('facebook')).toBe('facebook');
    expect(toAyrsharePlatform('linkedin')).toBe('linkedin');
    expect(toAyrsharePlatform('youtube')).toBe('youtube');
    expect(toAyrsharePlatform('tiktok')).toBe('tiktok');
  });

  it('maps a batch of platforms', () => {
    expect(toAyrsharePlatforms(['x', 'instagram'])).toEqual(['twitter', 'instagram']);
  });

  it('round-trips back to the canonical Platform', () => {
    expect(fromAyrsharePlatform('twitter')).toBe('x');
    expect(fromAyrsharePlatform('TWITTER')).toBe('x'); // case-insensitive
    expect(fromAyrsharePlatform('instagram')).toBe('instagram');
    expect(fromAyrsharePlatform('unknown')).toBeUndefined();
  });

  it('encodes media requirements per platform', () => {
    expect(MEDIA_REQUIRED.has('instagram')).toBe(true);
    expect(MEDIA_REQUIRED.has('youtube')).toBe(true);
    expect(MEDIA_REQUIRED.has('x')).toBe(false);
    expect(VIDEO_REQUIRED.has('youtube')).toBe(true);
    expect(VIDEO_REQUIRED.has('instagram')).toBe(false);
  });
});
