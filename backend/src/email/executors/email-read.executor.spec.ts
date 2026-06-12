import { Test, TestingModule } from '@nestjs/testing';
import { EmailReadExecutor } from './email-read.executor';
import { EmailService } from '../email.service';

describe('EmailReadExecutor', () => {
  it('should return email content', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailReadExecutor,
        { provide: EmailService, useValue: { get: jest.fn().mockResolvedValue({ id: '1', from: 'a@b.com', to: ['me@b.com'], subject: 'Hello', body: 'World', date: '2024-01-01' }) } },
      ],
    }).compile();
    const executor = module.get<EmailReadExecutor>(EmailReadExecutor);
    const result = await executor.execute({ id: '1' });
    expect(result).toContain('Hello');
    expect(result).toContain('World');
  });

  it('should error without id', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailReadExecutor, { provide: EmailService, useValue: { get: jest.fn() } }],
    }).compile();
    const result = await module.get<EmailReadExecutor>(EmailReadExecutor).execute({});
    expect(result).toContain('Error');
  });
});
