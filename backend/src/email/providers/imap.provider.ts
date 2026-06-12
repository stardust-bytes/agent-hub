import { Injectable } from '@nestjs/common';
import { EmailProvider, EmailMessage, SendEmailOptions } from './email-provider.interface';

@Injectable()
export class ImapProvider implements EmailProvider {
  async list(_folder: string, _limit: number, _offset: number): Promise<EmailMessage[]> {
    return [{ id: 'stub', from: '', to: [], subject: 'IMAP not configured', body: 'Set up SMTP/IMAP in Settings', date: new Date().toISOString() }];
  }
  async get(_id: string): Promise<EmailMessage> {
    return { id: 'stub', from: '', to: [], subject: 'IMAP not configured', body: '', date: '' };
  }
  async send(_options: SendEmailOptions): Promise<{ id: string }> {
    return { id: '' };
  }
  async search(_query: string, _folder?: string): Promise<EmailMessage[]> { return []; }
  async reply(_id: string, _body: string, _mode: 'reply' | 'reply_all' | 'forward'): Promise<{ id: string }> {
    return { id: '' };
  }
}
