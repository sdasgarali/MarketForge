/**
 * Minimal Google Drive v3 client using a SERVICE ACCOUNT — no `googleapis`
 * dependency (keeps the adapter lean). Signs a JWT with the service-account
 * private key (RS256, node:crypto), exchanges it for an access token, and calls
 * the Drive REST API with the global `fetch` (Node 22+).
 *
 * Supports: connectivity test, find-or-create folder, ensure a nested folder
 * path (e.g. <Brand>/videos/<topic>/), and multipart file upload.
 */
import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const SCOPE = 'https://www.googleapis.com/auth/drive';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

export interface GDriveConfig {
  clientEmail: string;
  privateKey: string;
  rootFolderId?: string;
}

export interface DriveFile {
  id: string;
  name: string;
  webViewLink?: string;
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

export class GDriveClient {
  private readonly clientEmail: string;
  private readonly privateKey: string;
  readonly rootFolderId?: string;
  private token?: { value: string; exp: number };

  constructor(cfg: GDriveConfig) {
    this.clientEmail = cfg.clientEmail;
    // Pasted keys often carry escaped newlines — normalise to real ones.
    this.privateKey = cfg.privateKey.includes('\\n')
      ? cfg.privateKey.replace(/\\n/g, '\n')
      : cfg.privateKey;
    this.rootFolderId = cfg.rootFolderId;
  }

  /** Service-account JWT → OAuth access token (cached until ~expiry). */
  private async accessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.token && this.token.exp - 60 > now) return this.token.value;

    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claim = b64url(
      JSON.stringify({
        iss: this.clientEmail,
        scope: SCOPE,
        aud: TOKEN_URL,
        iat: now,
        exp: now + 3600,
      }),
    );
    const signingInput = `${header}.${claim}`;
    const signer = createSign('RSA-SHA256');
    signer.update(signingInput);
    const signature = signer.sign(this.privateKey, 'base64url');
    const assertion = `${signingInput}.${signature}`;

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    const data = (await res.json()) as { access_token?: string; error_description?: string; error?: string };
    if (!res.ok || !data.access_token) {
      throw new Error(
        `Drive auth failed: ${data.error_description ?? data.error ?? res.status}`,
      );
    }
    this.token = { value: data.access_token, exp: now + 3600 };
    return data.access_token;
  }

  private async api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.accessToken();
    const res = await fetch(`${DRIVE}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      throw new Error(`Drive API ${path} → ${res.status}: ${await res.text()}`);
    }
    return (await res.json()) as T;
  }

  /** Connectivity probe: auth + read the target folder (or root) metadata. */
  async test(): Promise<{ ok: true; email: string; rootFolderId: string }> {
    await this.accessToken(); // throws on bad creds
    const target = this.rootFolderId ?? 'root';
    const meta = await this.api<{ id: string; name?: string }>(
      `/files/${target}?fields=id,name&supportsAllDrives=true`,
    );
    return { ok: true, email: this.clientEmail, rootFolderId: meta.id };
  }

  private async findFolder(name: string, parentId: string): Promise<string | undefined> {
    const q =
      `mimeType='${FOLDER_MIME}' and trashed=false and name='${name.replace(/'/g, "\\'")}'` +
      ` and '${parentId}' in parents`;
    const data = await this.api<{ files?: DriveFile[] }>(
      `/files?q=${encodeURIComponent(q)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    );
    return data.files?.[0]?.id;
  }

  private async createFolder(name: string, parentId: string): Promise<string> {
    const data = await this.api<DriveFile>('/files?supportsAllDrives=true', {
      method: 'POST',
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
    });
    return data.id;
  }

  async ensureFolder(name: string, parentId: string): Promise<string> {
    return (await this.findFolder(name, parentId)) ?? this.createFolder(name, parentId);
  }

  /** Ensure a nested path under root (defaults to config rootFolderId). Returns leaf id. */
  async ensureFolderPath(parts: string[], root?: string): Promise<string> {
    let parent = root ?? this.rootFolderId ?? 'root';
    for (const p of parts.filter(Boolean)) parent = await this.ensureFolder(p, parent);
    return parent;
  }

  /** Multipart upload a file into a folder. */
  async uploadFile(
    name: string,
    data: Buffer,
    contentType: string,
    parentId: string,
  ): Promise<DriveFile> {
    const token = await this.accessToken();
    const boundary = `mf${Date.now().toString(16)}`;
    const meta = JSON.stringify({ name, parents: [parentId] });
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`),
      data,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const res = await fetch(
      `${UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );
    if (!res.ok) throw new Error(`Drive upload failed ${res.status}: ${await res.text()}`);
    return (await res.json()) as DriveFile;
  }
}
