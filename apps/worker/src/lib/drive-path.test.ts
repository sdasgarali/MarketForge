import { describe, expect, it } from 'vitest';
import { driveContentPath, platformFolder, safeSegment, typeSubfolder } from './drive-path.js';

// A fixed instant: 2026-08-01 (UTC).
const DATE = new Date(Date.UTC(2026, 7, 1, 12, 0, 0));

describe('platformFolder', () => {
  it('maps known platforms to proper-cased labels', () => {
    expect(platformFolder('instagram')).toBe('Instagram');
    expect(platformFolder('youtube')).toBe('YouTube');
    expect(platformFolder('linkedin')).toBe('LinkedIn');
    expect(platformFolder('x')).toBe('X');
    expect(platformFolder('tiktok')).toBe('TikTok');
  });
  it('falls back to a capitalised id, then General', () => {
    expect(platformFolder('threads')).toBe('Threads');
    expect(platformFolder(null)).toBe('General');
  });
});

describe('typeSubfolder', () => {
  it('routes gif → GIF', () => {
    expect(typeSubfolder('gif')).toBe('GIF');
  });
  it('routes short/reel/story video → Shorts, long video → Video', () => {
    expect(typeSubfolder('video', 'short')).toBe('Shorts');
    expect(typeSubfolder('video', 'reel')).toBe('Shorts');
    expect(typeSubfolder('video', 'story')).toBe('Shorts');
    expect(typeSubfolder('video', 'video')).toBe('Video');
    expect(typeSubfolder('video', null)).toBe('Video');
  });
  it('routes images/posters → Image, audio → Audio', () => {
    expect(typeSubfolder('image', 'poster')).toBe('Image');
    expect(typeSubfolder('image', 'article')).toBe('Image');
    expect(typeSubfolder('audio')).toBe('Audio');
  });
});

describe('safeSegment', () => {
  it('strips slashes, collapses whitespace, bounds length', () => {
    expect(safeSegment('a/b\\c')).toBe('a-b-c');
    expect(safeSegment('  hello   world ')).toBe('hello world');
    expect(safeSegment('x'.repeat(200)).length).toBe(80);
    expect(safeSegment('')).toBe('untitled');
  });
});

describe('driveContentPath', () => {
  it('builds <Brand>/<Year>/<Month>/<Day>/<Platform>/<Type> for a short', () => {
    const p = driveContentPath({
      brandName: 'Exzelon',
      date: DATE,
      platform: 'instagram',
      kind: 'video',
      contentType: 'short',
    });
    expect(p.platformParts).toEqual(['Exzelon', '2026', '08-August', '01', 'Instagram']);
    expect(p.folderParts).toEqual(['Exzelon', '2026', '08-August', '01', 'Instagram', 'Shorts']);
    expect(p.typeFolder).toBe('Shorts');
  });

  it('puts posters under Image and sanitises the brand', () => {
    const p = driveContentPath({
      brandName: 'Acme/Corp',
      date: DATE,
      platform: 'linkedin',
      kind: 'image',
      contentType: 'poster',
    });
    expect(p.folderParts).toEqual(['Acme-Corp', '2026', '08-August', '01', 'LinkedIn', 'Image']);
  });
});
