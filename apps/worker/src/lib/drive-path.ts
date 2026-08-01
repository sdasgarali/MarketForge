/**
 * Drive content path builder (pure) — implements the operator's File Structure:
 *
 *   <Brand>/<Year>/<Month>/<Day>/<Platform>/
 *      ├── <topic>.txt        (Topic + Content)
 *      ├── Video/             (long videos)
 *      ├── Shorts/            (≤15s shorts / reels / stories)
 *      ├── Image/             (blog / case-study / poster / news images)
 *      └── GIF/               (gif loops)
 *
 * Kept pure (no I/O) so it is unit-testable without a live Drive. The Drive
 * client's `ensureFolderPath(parts)` consumes `folderParts`.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  x: 'X',
  tiktok: 'TikTok',
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Proper-cased platform folder name (falls back to the raw id, capitalised). */
export function platformFolder(platform?: string | null): string {
  const key = (platform ?? '').toLowerCase();
  return PLATFORM_LABEL[key] ?? (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'General');
}

/**
 * Type subfolder for an asset, per the plan:
 *  - gif                       → GIF
 *  - video (short/reel/story)  → Shorts
 *  - video (other)             → Video
 *  - image                     → Image
 *  - audio                     → Audio
 */
export function typeSubfolder(kind?: string | null, contentType?: string | null): string {
  const k = (kind ?? '').toLowerCase();
  const ct = (contentType ?? '').toLowerCase();
  if (k === 'gif') return 'GIF';
  if (k === 'audio') return 'Audio';
  if (k === 'video') {
    return ct === 'short' || ct === 'reel' || ct === 'story' ? 'Shorts' : 'Video';
  }
  // image / poster / thumbnail / doc → Image
  return 'Image';
}

export interface DrivePathInput {
  brandName: string;
  /** The content's calendar date (scheduledDate preferred, else createdAt). */
  date: Date;
  platform?: string | null;
  kind?: string | null;
  contentType?: string | null;
}

export interface DrivePath {
  /** Folder hierarchy down to (and including) the type subfolder, for asset uploads. */
  folderParts: string[];
  /** Folder hierarchy down to the Platform folder, where the TXT file lives. */
  platformParts: string[];
  /** Human label of the type subfolder (Video/Shorts/Image/GIF/Audio). */
  typeFolder: string;
}

/** Sanitise a folder/file segment for Drive (no slashes, trimmed, bounded). */
export function safeSegment(s: string, max = 80): string {
  return (s || 'untitled').replace(/[\\/]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, max) || 'untitled';
}

/**
 * Build the Drive folder hierarchy for a piece of content.
 * Uses UTC so the same instant maps to the same folder everywhere.
 */
export function driveContentPath(input: DrivePathInput): DrivePath {
  const d = input.date;
  const year = String(d.getUTCFullYear());
  const month = `${pad2(d.getUTCMonth() + 1)}-${MONTHS[d.getUTCMonth()]}`;
  const day = pad2(d.getUTCDate());
  const platform = platformFolder(input.platform);
  const brand = safeSegment(input.brandName, 60);

  const platformParts = [brand, year, month, day, platform];
  const typeFolder = typeSubfolder(input.kind, input.contentType);
  return {
    platformParts,
    folderParts: [...platformParts, typeFolder],
    typeFolder,
  };
}
