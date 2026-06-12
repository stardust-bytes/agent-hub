import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from '../../tools/executors/tool-executor.interface';
import { CalendarService } from '../calendar.service';

@Injectable()
export class CalendarListEventsExecutor implements ToolExecutor {
  readonly name = 'calendar_list_events';
  constructor(private readonly calendar: CalendarService) {}

  async execute(args: Record<string, unknown>, _context?: ToolContext): Promise<string> {
    const since = args.since ? String(args.since) : undefined;
    const until = args.until ? String(args.until) : undefined;
    try {
      const events = await this.calendar.listEvents(since, until);
      if (events.length === 0) return 'No events found.';
      return events.map(e =>
        `[${e.startTime.slice(0, 16)} - ${e.endTime.slice(0, 16)}] ${e.title}${e.htmlLink ? ` (${e.htmlLink})` : ''}`
      ).join('\n');
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
