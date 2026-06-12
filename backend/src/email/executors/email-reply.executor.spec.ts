import { Test, TestingModule } from '@nestjs/testing';
import { EmailReplyExecutor } from './email-reply.executor';
import { EmailService } from '../email.service';

describe('EmailReplyExecutor', () => {
  it('should reply to email', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailReplyExecutor,
        { provide: EmailService, useValue: { reply: jest.fn().mockResolvedValue({ id: 'reply1' }) } },
      ],
    }).compile();
    const result = await module.get<EmailReplyExecutor>(EmailReplyExecutor).execute({ id: '1', body: 'Thanks!' });
    expect(result).toContain('Replied');
  });
});
