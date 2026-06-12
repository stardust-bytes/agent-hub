import { Test, TestingModule } from '@nestjs/testing';
import { EmailSearchExecutor } from './email-search.executor';
import { EmailService } from '../email.service';

describe('EmailSearchExecutor', () => {
  it('should search and return results', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailSearchExecutor,
        { provide: EmailService, useValue: { search: jest.fn().mockResolvedValue([{ id: '1', from: 'a@b.com', subject: 'Meeting', date: '2024-01-01', to: [] }]) } },
      ],
    }).compile();
    const result = await module.get<EmailSearchExecutor>(EmailSearchExecutor).execute({ query: 'meeting' });
    expect(result).toContain('Meeting');
  });
});
