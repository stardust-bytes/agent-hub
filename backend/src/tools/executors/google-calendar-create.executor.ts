import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GoogleCalendarService } from '../../connector/providers/google/google-calendar.service';

@Injectable()
export class GoogleCalendarCreateExecutor implements ToolExecutor {
  readonly name = 'google_calendar_create';
  readonly description = 'Create a new Google Calendar event.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: 'Event title' },
      startTime: { type: 'string', description: 'Start time ISO string' },
      endTime: { type: 'string', description: 'End time ISO string' },
      description: { type: 'string', description: 'Event description' },
      attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee emails' },
      location: { type: 'string', description: 'Event location' },
    },
    required: ['title', 'startTime', 'endTime'] as string[],
  };

  constructor(private readonly calendar: GoogleCalendarService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const event = await this.calendar.createEvent(args as any);
      return `Event created: "${event.summary}" at ${event.startTime}. ID: ${event.id}`;
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
