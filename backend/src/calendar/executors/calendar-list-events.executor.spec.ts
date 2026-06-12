import { Test, TestingModule } from '@nestjs/testing';
import { CalendarListEventsExecutor } from './calendar-list-events.executor';
import { CalendarService } from '../calendar.service';

describe('CalendarListEventsExecutor', () => {
  it('should return event list', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarListEventsExecutor,
        { provide: CalendarService, useValue: { listEvents: jest.fn().mockResolvedValue([{ id: '1', title: 'Meeting', startTime: '2024-01-01T10:00:00', endTime: '2024-01-01T11:00:00' }]) } },
      ],
    }).compile();
    const result = await module.get<CalendarListEventsExecutor>(CalendarListEventsExecutor).execute({});
    expect(result).toContain('Meeting');
    expect(result).toContain('10:00');
  });
});
