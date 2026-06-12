import { Test, TestingModule } from '@nestjs/testing';
import { CalendarCheckAvailabilityExecutor } from './calendar-check-availability.executor';
import { CalendarService } from '../calendar.service';

describe('CalendarCheckAvailabilityExecutor', () => {
  it('should report available', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarCheckAvailabilityExecutor,
        { provide: CalendarService, useValue: { checkAvailability: jest.fn().mockResolvedValue({ available: true }) } },
      ],
    }).compile();
    const result = await module.get<CalendarCheckAvailabilityExecutor>(CalendarCheckAvailabilityExecutor).execute({ startTime: '2024-01-01T10:00:00', endTime: '2024-01-01T11:00:00' });
    expect(result).toContain('available');
  });
});
