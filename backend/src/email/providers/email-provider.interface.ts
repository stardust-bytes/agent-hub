export interface EmailMessage {
  id: string;
  threadId?: string;
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  date: string;
  attachments?: Array<{ filename: string; contentType: string; data: Buffer }>;
  unread?: boolean;
}

export interface SendEmailOptions {
  to: string[];
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{ filename: string; content: Buffer | string }>;
}

export interface EmailProvider {
  list(folder: string, limit: number, offset: number): Promise<EmailMessage[]>;
  get(id: string): Promise<EmailMessage>;
  send(options: SendEmailOptions): Promise<{ id: string }>;
  search(query: string, folder?: string): Promise<EmailMessage[]>;
  reply(id: string, body: string, mode: 'reply' | 'reply_all' | 'forward'): Promise<{ id: string }>;
}
