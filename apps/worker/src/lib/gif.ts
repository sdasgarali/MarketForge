/**
 * gif — export a short mp4 clip to an animated .gif using the cross-platform
 * ffmpeg binary bundled by `ffmpeg-static`. Invoked via `node:child_process`.
 *
 * The GIF path (media-policy action 'gif') generates a short SILENT Kling clip
 * via the video adapter, then this helper converts the mp4 bytes → gif bytes so
 * the processor can `storage.put` both.
 *
 * Graceful degradation: if the ffmpeg binary is unavailable at runtime (e.g. an
 * unsupported platform where `ffmpeg-static` shipped no binary), `exportGif`
 * throws a {@link GifExportUnavailableError}. The processor catches it and
 * degrades to storing the silent mp4 tagged as gif-style + a warning notify,
 * rather than crashing.
 */
import { spawn } from 'node:child_process';
import { request } from 'undici';

/** Thrown when ffmpeg cannot run (binary missing / spawn failure). */
export class GifExportUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'GifExportUnavailableError';
  }
}

/** Resolve the bundled ffmpeg binary path (or undefined if none shipped). */
async function resolveFfmpegPath(): Promise<string | undefined> {
  try {
    // ffmpeg-static's default export is the absolute path to the binary (string),
    // or null on platforms without a prebuilt binary. Its bundled .d.ts types the
    // default loosely, so read it via unknown and narrow to a string.
    const mod = (await import('ffmpeg-static')) as unknown as { default?: unknown };
    return typeof mod.default === 'string' ? mod.default : undefined;
  } catch {
    return undefined;
  }
}

/** Download an mp4 from a URL into a Buffer (adapters may return a URL only). */
export async function downloadToBuffer(url: string): Promise<Buffer> {
  const res = await request(url, {
    method: 'GET',
    headersTimeout: 30_000,
    bodyTimeout: 60_000,
  });
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`download failed: ${url} returned ${res.statusCode}`);
  }
  const arrayBuf = await res.body.arrayBuffer();
  return Buffer.from(arrayBuf);
}

export interface GifExportOptions {
  /** Output frame rate (fps). Lower = smaller file. Default 12. */
  fps?: number;
  /** Max output width in px (height auto, preserving aspect). Default 480. */
  width?: number;
}

/**
 * Convert mp4 bytes → animated gif bytes with ffmpeg (single-pass palette via
 * split/palettegen/paletteuse for good quality). Reads mp4 from stdin, writes
 * gif to stdout — no temp files, cross-platform.
 *
 * @throws {GifExportUnavailableError} when ffmpeg is not runnable.
 */
export async function exportGif(mp4: Buffer, opts: GifExportOptions = {}): Promise<Buffer> {
  const ffmpegPath = await resolveFfmpegPath();
  if (!ffmpegPath) {
    throw new GifExportUnavailableError('ffmpeg-static provided no binary for this platform');
  }

  const fps = opts.fps ?? 12;
  const width = opts.width ?? 480;
  // filter: set fps + scale (preserve aspect, even width) + high-quality palette.
  const vf =
    `fps=${fps},scale=${width}:-2:flags=lanczos,` +
    `split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`;

  const args = [
    '-hide_banner',
    '-loglevel', 'error',
    '-i', 'pipe:0',
    '-vf', vf,
    '-loop', '0',
    '-an', // drop audio (gif is silent)
    '-f', 'gif',
    'pipe:1',
  ];

  return await new Promise<Buffer>((resolve, reject) => {
    let child;
    try {
      child = spawn(ffmpegPath, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      reject(new GifExportUnavailableError('failed to spawn ffmpeg', { cause: err }));
      return;
    }

    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];

    child.on('error', (err) => {
      reject(new GifExportUnavailableError(`ffmpeg spawn error: ${err.message}`, { cause: err }));
    });
    child.stdout.on('data', (d: Buffer) => chunks.push(d));
    child.stderr.on('data', (d: Buffer) => errChunks.push(d));
    child.on('close', (code) => {
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks));
      } else {
        const stderr = Buffer.concat(errChunks).toString('utf8').slice(0, 500);
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
      }
    });

    // Feed the mp4 in; guard against EPIPE if ffmpeg dies early.
    child.stdin.on('error', () => {
      /* swallowed — surfaced via close/error handlers */
    });
    child.stdin.write(mp4);
    child.stdin.end();
  });
}
