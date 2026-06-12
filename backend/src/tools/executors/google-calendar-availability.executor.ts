import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GoogleCalendarService } from '../../connector/providers/google/google-calendar.service';

@Injectable()
export class GoogleCalendarAvailabilityExecutor implements ToolExecutor {
  readonly name = 'google_calendar_availability';
  readonly description = 'Check if a time slot is available in Google Calendar.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      startTime: { type: 'string', description: 'Start time ISO string' },
      endTime: { type: 'string', description: 'End time ISO string' },
    },
    required: ['startTime', 'endTime'] as string[],
  };

  constructor(private readonly calendar: GoogleCalendarService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const result = await this.calendar.checkAvailability(args.startTime as string, args.endTime as string);
      if (result.available) return 'Time slot is available.';
      return `Time slot is busy:\n${result.busySlots.map(b => `  ${b.start} - ${b.end}`).join('\n')}`;
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
