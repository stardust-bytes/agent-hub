import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GoogleCalendarService } from '../../connector/providers/google/google-calendar.service';

@Injectable()
export class GoogleCalendarListExecutor implements ToolExecutor {
  readonly name = 'google_calendar_list';
  readonly description = 'List Google Calendar events within a date range.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      since: { type: 'string', description: 'Start date ISO string' },
      until: { type: 'string', description: 'End date ISO string' },
    },
  };

  constructor(private readonly calendar: GoogleCalendarService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const events = await this.calendar.listEvents(args.since as string, args.until as string);
      if (events.length === 0) return 'No events found.';
      return events.map(e => `[${e.startTime}] ${e.summary}${e.location ? ` @ ${e.location}` : ''}`).join('\n');
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
