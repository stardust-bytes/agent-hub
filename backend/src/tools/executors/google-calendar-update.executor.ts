import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GoogleCalendarService } from '../../connector/providers/google/google-calendar.service';

@Injectable()
export class GoogleCalendarUpdateExecutor implements ToolExecutor {
  readonly name = 'google_calendar_update';
  readonly description = 'Update a Google Calendar event.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      id: { type: 'string', description: 'Event ID to update' },
      title: { type: 'string', description: 'New title' },
      startTime: { type: 'string', description: 'New start time ISO string' },
      endTime: { type: 'string', description: 'New end time ISO string' },
    },
    required: ['id'] as string[],
  };

  constructor(private readonly calendar: GoogleCalendarService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const event = await this.calendar.updateEvent(args.id as string, {
        title: args.title as string,
        startTime: args.startTime as string,
        endTime: args.endTime as string,
      });
      return `Event updated: "${event.summary}".`;
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
