import { Test, TestingModule } from '@nestjs/testing';
import { CalendarUpdateEventExecutor } from './calendar-update-event.executor';
import { CalendarService } from '../calendar.service';

describe('CalendarUpdateEventExecutor', () => {
  it('should update event', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarUpdateEventExecutor,
        { provide: CalendarService, useValue: { updateEvent: jest.fn().mockResolvedValue({ id: 'evt1', title: 'Updated' }), deleteEvent: jest.fn() } },
      ],
    }).compile();
    const result = await module.get<CalendarUpdateEventExecutor>(CalendarUpdateEventExecutor).execute({ id: 'evt1', title: 'Updated' });
    expect(result).toContain('Updated');
  });
});
