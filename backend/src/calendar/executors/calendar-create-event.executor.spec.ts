import { Test, TestingModule } from '@nestjs/testing';
import { CalendarCreateEventExecutor } from './calendar-create-event.executor';
import { CalendarService } from '../calendar.service';

describe('CalendarCreateEventExecutor', () => {
  it('should create event', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarCreateEventExecutor,
        { provide: CalendarService, useValue: { createEvent: jest.fn().mockResolvedValue({ id: 'evt1', title: 'Meeting', startTime: '2024-01-01T10:00:00', endTime: '2024-01-01T11:00:00' }) } },
      ],
    }).compile();
    const result = await module.get<CalendarCreateEventExecutor>(CalendarCreateEventExecutor).execute({ title: 'Meeting', startTime: '2024-01-01T10:00:00', endTime: '2024-01-01T11:00:00' });
    expect(result).toContain('Meeting');
  });
});
