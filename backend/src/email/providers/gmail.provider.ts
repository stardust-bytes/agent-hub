import { Injectable } from '@nestjs/common';
import { EmailProvider, EmailMessage, SendEmailOptions } from './email-provider.interface';
import { OAuthService } from '../../oauth/oauth.service';
import { google } from 'googleapis';

@Injectable()
export class GmailProvider implements EmailProvider {
  private gmail: ReturnType<typeof google.gmail> | null = null;
  private initialized = false;

  constructor(private readonly oauth: OAuthService) {}

  private async ensureInit() {
    if (this.initialized) return;
    const result = await this.oauth.getClient();
    if (result) {
      this.gmail = google.gmail({ version: 'v1', auth: result.client as any });
    }
    this.initialized = true;
  }

  async list(folder: string, limit: number, offset: number): Promise<EmailMessage[]> {
    await this.ensureInit();
    if (!this.gmail) return [];
    const label = folder === 'INBOX' ? 'INBOX' : folder;
    const res = await this.gmail.users.messages.list({
      userId: 'me', labelIds: [label], maxResults: limit,
    });
    const messages = res.data.messages || [];
    const result: EmailMessage[] = [];
    const toFetch = messages.slice(offset, offset + limit);
    for (const msg of toFetch) {
      const detail = await this.gmail.users.messages.get({ userId: 'me', id: msg.id! });
      result.push(this.parseMessage(detail.data));
    }
    return result;
  }

  async get(id: string): Promise<EmailMessage> {
    await this.ensureInit();
    if (!this.gmail) throw new Error('Gmail not configured');
    const res = await this.gmail.users.messages.get({ userId: 'me', id });
    return this.parseMessage(res.data);
  }

  async send(options: SendEmailOptions): Promise<{ id: string }> {
    await this.ensureInit();
    if (!this.gmail) throw new Error('Gmail not configured');
    const utf8Body = [
      `To: ${options.to.join(', ')}`,
      options.cc?.length ? `Cc: ${options.cc.join(', ')}` : '',
      `Subject: ${options.subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      options.body,
    ].filter(Boolean).join('\n');
    const encoded = Buffer.from(utf8Body).toString('base64url');
    const res = await this.gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
    return { id: res.data.id! };
  }

  async search(query: string, _folder?: string): Promise<EmailMessage[]> {
    await this.ensureInit();
    if (!this.gmail) return [];
    const res = await this.gmail.users.messages.list({
      userId: 'me', q: query, maxResults: 20,
    });
    const messages = res.data.messages || [];
    const result: EmailMessage[] = [];
    for (const msg of messages) {
      const detail = await this.gmail.users.messages.get({ userId: 'me', id: msg.id! });
      result.push(this.parseMessage(detail.data));
    }
    return result;
  }

  async reply(id: string, body: string, mode: 'reply' | 'reply_all' | 'forward'): Promise<{ id: string }> {
    await this.ensureInit();
    if (!this.gmail) throw new Error('Gmail not configured');
    const original = await this.gmail.users.messages.get({ userId: 'me', id });
    const headers = original.data.payload?.headers || [];
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
    const to = mode === 'forward' ? '' : headers.find((h: any) => h.name === 'From')?.value || '';
    const ref = original.data.threadId || id;
    const newSubject = mode === 'forward' ? `Fwd: ${subject}` : `Re: ${subject}`;
    const utf8Body = [
      `To: ${to}`,
      `Subject: ${newSubject}`,
      'Content-Type: text/plain; charset=utf-8',
      'References: ' + ref,
      'In-Reply-To: ' + id,
      '',
      body,
    ].join('\n');
    const encoded = Buffer.from(utf8Body).toString('base64url');
    const res = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encoded, threadId: ref },
    });
    return { id: res.data.id! };
  }

  private parseMessage(data: any): EmailMessage {
    const headers = data.payload?.headers || [];
    const getHeader = (name: string) => headers.find((h: any) => h.name === name)?.value || '';
    const body = data.payload?.parts?.[0]?.body?.data
      ? Buffer.from(data.payload.parts[0].body.data, 'base64').toString('utf-8')
      : data.payload?.body?.data
        ? Buffer.from(data.payload.body.data, 'base64').toString('utf-8')
        : '';
    return {
      id: data.id,
      threadId: data.threadId,
      from: getHeader('From'),
      to: (getHeader('To') || '').split(',').map((s: string) => s.trim()),
      subject: getHeader('Subject'),
      body,
      date: getHeader('Date'),
      unread: data.labelIds?.includes('UNREAD') || false,
    };
  }
}
