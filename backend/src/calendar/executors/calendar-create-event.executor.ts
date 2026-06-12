import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from '../../tools/executors/tool-executor.interface';
import { CalendarService } from '../calendar.service';

@Injectable()
export class CalendarCreateEventExecutor implements ToolExecutor {
  readonly name = 'calendar_create_event';
  constructor(private readonly calendar: CalendarService) {}

  async execute(args: Record<string, unknown>, _context?: ToolContext): Promise<string> {
    const title = String(args.title ?? '');
    const startTime = String(args.startTime ?? '');
    const endTime = String(args.endTime ?? '');
    if (!title) return 'Error: "title" is required';
    if (!startTime) return 'Error: "startTime" is required';
    if (!endTime) return 'Error: "endTime" is required';
    try {
      const event = await this.calendar.createEvent({
        title,
        startTime,
        endTime,
        description: args.description ? String(args.description) : undefined,
        attendees: Array.isArray(args.attendees) ? args.attendees.map(String) : undefined,
        location: args.location ? String(args.location) : undefined,
      });
      return `Event created: ${event.title} at ${event.startTime}${event.htmlLink ? ` (${event.htmlLink})` : ''}`;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
