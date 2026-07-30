import { join, resolve } from 'node:path';

/**
 * Cross-platform path helpers. Always use these instead of hand-built strings
 * so Windows and Linux behave identically (global cross-platform rule).
 */
export function dataPath(dataDir: string, ...segments: string[]): string {
  return resolve(join(dataDir, ...segments));
}

export function isWindows(): boolean {
  return process.platform === 'win32';
}
