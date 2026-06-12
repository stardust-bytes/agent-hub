import { Test, TestingModule } from '@nestjs/testing';
import { EmailSendExecutor } from './email-send.executor';
import { EmailService } from '../email.service';

describe('EmailSendExecutor', () => {
  it('should send email and return success', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailSendExecutor,
        { provide: EmailService, useValue: { send: jest.fn().mockResolvedValue({ id: 'sent1' }) } },
      ],
    }).compile();
    const result = await module.get<EmailSendExecutor>(EmailSendExecutor).execute({ to: ['a@b.com'], subject: 'Hi', body: 'Hello' });
    expect(result).toContain('sent1');
  });

  it('should error without recipients', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailSendExecutor, { provide: EmailService, useValue: { send: jest.fn() } }],
    }).compile();
    const result = await module.get<EmailSendExecutor>(EmailSendExecutor).execute({ subject: 'Hi' });
    expect(result).toContain('Error');
  });
});
