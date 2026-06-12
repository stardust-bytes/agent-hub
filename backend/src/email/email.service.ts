import { Injectable } from '@nestjs/common';
import { EmailProvider, SendEmailOptions, EmailMessage } from './providers/email-provider.interface';
import { GmailProvider } from './providers/gmail.provider';
import { ImapProvider } from './providers/imap.provider';
import { OAuthService } from '../oauth/oauth.service';

@Injectable()
export class EmailService {
  private _provider: EmailProvider | null = null;

  constructor(private readonly oauth: OAuthService) {}

  private async getProvider(): Promise<EmailProvider> {
    if (this._provider) return this._provider;
    const oauthConfig = await this.oauth.getConfig();
    if (oauthConfig?.tokens?.access_token) {
      this._provider = new GmailProvider(this.oauth);
    } else {
      this._provider = new ImapProvider();
    }
    return this._provider;
  }

  async list(folder: string = 'INBOX', limit: number = 20, offset: number = 0): Promise<EmailMessage[]> {
    const p = await this.getProvider();
    return p.list(folder, limit, offset);
  }

  async get(id: string): Promise<EmailMessage> {
    const p = await this.getProvider();
    return p.get(id);
  }

  async send(options: SendEmailOptions): Promise<{ id: string }> {
    const p = await this.getProvider();
    return p.send(options);
  }

  async search(query: string, folder?: string): Promise<EmailMessage[]> {
    const p = await this.getProvider();
    return p.search(query, folder);
  }

  async reply(id: string, body: string, mode: 'reply' | 'reply_all' | 'forward' = 'reply'): Promise<{ id: string }> {
    const p = await this.getProvider();
    return p.reply(id, body, mode);
  }
}
