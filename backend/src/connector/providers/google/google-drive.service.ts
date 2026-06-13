import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { GoogleOAuthService } from './google-oauth.service';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
}

@Injectable()
export class GoogleDriveService {
  constructor(private readonly googleOAuth: GoogleOAuthService) {}

  private async getDrive() {
    const auth = await this.googleOAuth.getAuthenticatedClient('google_drive', { clientId: '', clientSecret: '', redirectUri: '' });
    if (!auth) throw new Error('Google not connected');
    return google.drive({ version: 'v3', auth: auth as any });
  }

  async search(query: string, pageSize = 20): Promise<DriveFile[]> {
    const drive = await this.getDrive();
    const res = await drive.files.list({ q: `name contains '${query.replace(/'/g, "\\'")}'`, pageSize, fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)' });
    return (res.data.files ?? []).map(f => ({
      id: f.id!,
      name: f.name!,
      mimeType: f.mimeType!,
      size: f.size ?? undefined,
      modifiedTime: f.modifiedTime ?? undefined,
      webViewLink: f.webViewLink ?? undefined,
    }));
  }

  async get(id: string): Promise<DriveFile & { content?: string }> {
    const drive = await this.getDrive();
    const meta = await drive.files.get({ fileId: id, fields: 'id,name,mimeType,size,modifiedTime,webViewLink' });
    let content: string | undefined;

    if (meta.data.mimeType === 'text/plain' || meta.data.mimeType?.includes('text')) {
      const resp = await drive.files.get({ fileId: id, alt: 'media' }, { responseType: 'text' });
      content = resp.data as string;
    }

    return {
      id: meta.data.id!,
      name: meta.data.name!,
      mimeType: meta.data.mimeType!,
      size: meta.data.size ?? undefined,
      modifiedTime: meta.data.modifiedTime ?? undefined,
      webViewLink: meta.data.webViewLink ?? undefined,
      content,
    };
  }

  async listFiles(folderId?: string, pageSize = 50): Promise<DriveFile[]> {
    const drive = await this.getDrive();
    const q = folderId ? `'${folderId}' in parents` : '';
    const res = await drive.files.list({ q, pageSize, fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)' });
    return (res.data.files ?? []).map(f => ({
      id: f.id!,
      name: f.name!,
      mimeType: f.mimeType!,
      size: f.size ?? undefined,
      modifiedTime: f.modifiedTime ?? undefined,
      webViewLink: f.webViewLink ?? undefined,
    }));
  }

  async createFolder(name: string, parentFolderId?: string): Promise<DriveFile> {
    const drive = await this.getDrive();
    const body: { name: string; mimeType: string; parents?: string[] } = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentFolderId) body.parents = [parentFolderId];
    const res = await drive.files.create({
      requestBody: body,
      fields: 'id,name,mimeType,size,modifiedTime,webViewLink',
    });
    return { id: res.data.id!, name: res.data.name!, mimeType: res.data.mimeType!, webViewLink: res.data.webViewLink ?? undefined };
  }

  async upload(name: string, contentBase64: string, mimeType = 'text/plain'): Promise<DriveFile> {
    const drive = await this.getDrive();
    const body = Buffer.from(contentBase64, 'base64');
    const res = await drive.files.create({
      requestBody: { name },
      media: { mimeType, body },
      fields: 'id,name,mimeType,size,modifiedTime,webViewLink',
    });
    return { id: res.data.id!, name: res.data.name!, mimeType: res.data.mimeType! };
  }
}
