import { Test, TestingModule } from '@nestjs/testing';
import { CalendarService } from './calendar.service';
import { OAuthService } from '../oauth/oauth.service';

describe('CalendarService', () => {
  let service: CalendarService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarService,
        { provide: OAuthService, useValue: { getConfig: jest.fn().mockResolvedValue(null) } },
      ],
    }).compile();
    service = module.get<CalendarService>(CalendarService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
