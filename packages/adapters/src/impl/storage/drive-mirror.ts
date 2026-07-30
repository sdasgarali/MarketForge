/**
 * DriveMirror — helper skeleton for the low-priority Google Drive MIRROR path
 * (ADR-006). Drive is NOT the system of record: S3 is primary. Drive caps
 * sustained writes at ~3 req/s/account and meters a shared quota-unit pool, so
 * mirroring is best-effort, rate-limited, and (for heavy brands) sharded across
 * multiple service accounts.
 *
 * This is intentionally a skeleton: it defines the mirror contract and a
 * client-side throttle, but the actual Drive API upload is left unwired (no
 * googleapis dependency pulled into the adapter package for a non-primary path).
 * When enabled, implement `mirror()` against the Drive v3 `files.create`
 * multipart upload using a service-account JWT from AdapterEnv.
 */
import { AdapterError } from '../../errors.js';

export interface DriveMirrorOptions {
  clientEmail: string;
  privateKey: string;
  rootFolderId: string;
  /** Max sustained writes/sec/account (Drive hard cap ~3). */
  maxWritesPerSec?: number;
}

export interface DriveMirrorResult {
  fileId: string;
  webViewLink?: string;
}

export class DriveMirror {
  readonly name = 'drive-mirror';
  private readonly opts: Required<Pick<DriveMirrorOptions, 'maxWritesPerSec'>> &
    DriveMirrorOptions;
  private lastWriteAt = 0;

  constructor(opts: DriveMirrorOptions) {
    this.opts = { maxWritesPerSec: 3, ...opts };
  }

  /** Client-side throttle so we never exceed Drive's per-account write cap. */
  private async throttle(): Promise<void> {
    const minGapMs = 1000 / this.opts.maxWritesPerSec;
    const wait = this.lastWriteAt + minGapMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastWriteAt = Date.now();
  }

  /**
   * Mirror an object to Drive. Skeleton — throttles then throws NotWired until
   * the Drive upload is implemented. Callers treat mirror failures as
   * non-fatal (S3 remains the source of truth).
   */
  async mirror(_key: string, _data: Buffer, _contentType?: string): Promise<DriveMirrorResult> {
    await this.throttle();
    // TODO(drive): implement Drive v3 files.create multipart upload via a
    // service-account JWT (clientEmail/privateKey) into rootFolderId.
    void this.opts.clientEmail;
    void this.opts.privateKey;
    void this.opts.rootFolderId;
    throw new AdapterError('DriveMirror.mirror not wired (non-primary path, ADR-006)', this.name);
  }
}
