/**
 * video-concat — stitch N mp4 clip buffers into a single mp4 using the bundled
 * cross-platform ffmpeg binary (ffmpeg-static). Used by the long-form video path
 * (operator plan §8): a big video is generated as N ≤10s clips, then concatenated
 * here into one file before storage + Drive mirror.
 *
 * Uses the ffmpeg concat demuxer with a re-encode (independently generated clips
 * may differ slightly in encoder params, which `-c copy` cannot stitch). Reads
 * from temp files (concat demuxer requires seekable inputs), cross-platform via
 * os.tmpdir(), and always cleans up.
 *
 * Graceful degradation: if ffmpeg is unavailable, throws {@link VideoConcatUnavailableError}
 * so the processor can fall back to storing the clips individually.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export class VideoConcatUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'VideoConcatUnavailableError';
  }
}

async function resolveFfmpegPath(): Promise<string | undefined> {
  try {
    const mod = (await import('ffmpeg-static')) as unknown as { default?: unknown };
    return typeof mod.default === 'string' ? mod.default : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Concatenate mp4 buffers into a single mp4. Requires >= 1 clip; a single clip is
 * returned as-is (no ffmpeg needed).
 *
 * @throws {VideoConcatUnavailableError} when ffmpeg cannot run.
 */
export async function concatMp4(clips: Buffer[]): Promise<Buffer> {
  const usable = clips.filter((b) => b && b.length > 0);
  if (usable.length === 0) throw new Error('concatMp4: no clips to concatenate');
  if (usable.length === 1) return usable[0]!;

  const ffmpegPath = await resolveFfmpegPath();
  if (!ffmpegPath) {
    throw new VideoConcatUnavailableError('ffmpeg-static provided no binary for this platform');
  }

  const dir = await mkdtemp(join(tmpdir(), 'mf-concat-'));
  try {
    const paths: string[] = [];
    for (let i = 0; i < usable.length; i++) {
      const p = join(dir, `clip-${String(i).padStart(4, '0')}.mp4`);
      await writeFile(p, usable[i]!);
      paths.push(p);
    }
    // concat demuxer list file: one `file '<path>'` per line (single quotes escaped).
    const listPath = join(dir, 'list.txt');
    const listBody = paths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
    await writeFile(listPath, listBody, 'utf8');

    const outPath = join(dir, 'out.mp4');
    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-y',
      outPath,
    ];

    await new Promise<void>((resolve, reject) => {
      let child;
      try {
        child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
      } catch (err) {
        reject(new VideoConcatUnavailableError('failed to spawn ffmpeg', { cause: err }));
        return;
      }
      const errChunks: Buffer[] = [];
      child.on('error', (err) =>
        reject(new VideoConcatUnavailableError(`ffmpeg spawn error: ${err.message}`, { cause: err })),
      );
      child.stderr?.on('data', (d: Buffer) => errChunks.push(d));
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg concat exited ${code}: ${Buffer.concat(errChunks).toString('utf8').slice(0, 500)}`));
      });
    });

    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
