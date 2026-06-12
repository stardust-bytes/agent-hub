import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { OAuthService } from '../oauth/oauth.service';

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: OAuthService, useValue: { getConfig: jest.fn().mockResolvedValue(null) } },
      ],
    }).compile();
    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
