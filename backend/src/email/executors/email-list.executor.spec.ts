import { Test, TestingModule } from '@nestjs/testing';
import { EmailListExecutor } from './email-list.executor';
import { EmailService } from '../email.service';

describe('EmailListExecutor', () => {
  let executor: EmailListExecutor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailListExecutor,
        { provide: EmailService, useValue: { list: jest.fn().mockResolvedValue([{ id: '1', from: 'a@b.com', subject: 'Test', date: '2024-01-01T00:00:00Z', to: [], unread: true }]) } },
      ],
    }).compile();
    executor = module.get<EmailListExecutor>(EmailListExecutor);
  });

  it('should return formatted email list', async () => {
    const result = await executor.execute({});
    expect(result).toContain('UNREAD');
    expect(result).toContain('a@b.com');
    expect(result).toContain('Test');
  });

  it('should handle empty inbox', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailListExecutor,
        { provide: EmailService, useValue: { list: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();
    const exec = module.get<EmailListExecutor>(EmailListExecutor);
    const result = await exec.execute({});
    expect(result).toBe('No emails found.');
  });
});
