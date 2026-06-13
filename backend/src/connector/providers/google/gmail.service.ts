import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { GoogleOAuthService } from './google-oauth.service';

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  body?: string;
  labels: string[];
}

@Injectable()
export class GmailService {
  constructor(private readonly googleOAuth: GoogleOAuthService) {}

  private async getGmail() {
    const auth = await this.googleOAuth.getAuthenticatedClient('google_gmail');
    if (!auth) throw new Error('Google not connected');
    return google.gmail({ version: 'v1', auth: auth as any });
  }

  async search(query: string, maxResults = 20): Promise<GmailMessage[]> {
    const gmail = await this.getGmail();
    const res = await gmail.users.messages.list({ userId: 'me', q: query, maxResults });
    const ids = res.data.messages?.map(m => m.id!) ?? [];
    if (ids.length === 0) return [];
    return Promise.all(ids.map(id => this.get(id)));
  }

  async get(id: string): Promise<GmailMessage> {
    const gmail = await this.getGmail();
    const res = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    const headers = (res.data.payload?.headers ?? []).reduce((acc, h) => {
      if (h.name) acc[h.name.toLowerCase()] = h.value ?? '';
      return acc;
    }, {} as Record<string, string>);

    let body = '';
    const parts = res.data.payload?.parts ?? [];
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        body = Buffer.from(part.body.data, 'base64url').toString('utf-8');
        break;
      }
    }
    if (!body && res.data.payload?.body?.data) {
      body = Buffer.from(res.data.payload.body.data, 'base64url').toString('utf-8');
    }

    return {
      id: res.data.id!,
      threadId: res.data.threadId!,
      subject: headers['subject'] ?? '',
      from: headers['from'] ?? '',
      to: headers['to'] ?? '',
      date: headers['date'] ?? '',
      snippet: res.data.snippet ?? '',
      body,
      labels: res.data.labelIds ?? [],
    };
  }

  private encodeMimeHeader(value: string): string {
    return /[^\x00-\x7F]/.test(value)
      ? `=?UTF-8?B?${Buffer.from(value, 'utf-8').toString('base64')}?=`
      : value;
  }

  private buildEmail(lines: string[]): string {
    return lines.join('\r\n');
  }

  async send(to: string[], subject: string, body: string, cc?: string[], bcc?: string[]): Promise<{ id: string }> {
    const gmail = await this.getGmail();
    const headers = [
      `To: ${to.map(a => this.encodeMimeHeader(a)).join(', ')}`,
      cc?.length ? `Cc: ${cc.map(a => this.encodeMimeHeader(a)).join(', ')}` : null,
      bcc?.length ? `Bcc: ${bcc.map(a => this.encodeMimeHeader(a)).join(', ')}` : null,
      `Subject: ${this.encodeMimeHeader(subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: base64',
    ].filter(Boolean);
    const email = this.buildEmail([...headers, '', Buffer.from(body, 'utf-8').toString('base64')]);

    const encoded = Buffer.from(email, 'utf-8').toString('base64url');
    const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
    return { id: res.data.id! };
  }

  async createDraft(to: string[], subject: string, body: string): Promise<{ id: string }> {
    const gmail = await this.getGmail();
    const headers = [
      `To: ${to.map(a => this.encodeMimeHeader(a)).join(', ')}`,
      `Subject: ${this.encodeMimeHeader(subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: base64',
    ];
    const email = this.buildEmail([...headers, '', Buffer.from(body, 'utf-8').toString('base64')]);

    const encoded = Buffer.from(email, 'utf-8').toString('base64url');
    const res = await gmail.users.drafts.create({ userId: 'me', requestBody: { message: { raw: encoded } } });
    return { id: res.data.id! };
  }

  async listLabels(): Promise<{ id: string; name: string }[]> {
    const gmail = await this.getGmail();
    const res = await gmail.users.labels.list({ userId: 'me' });
    return (res.data.labels ?? []).map(l => ({ id: l.id!, name: l.name! }));
  }
}
