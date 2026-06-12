import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from '../../tools/executors/tool-executor.interface';
import { CalendarService } from '../calendar.service';

@Injectable()
export class CalendarUpdateEventExecutor implements ToolExecutor {
  readonly name = 'calendar_update_event';
  constructor(private readonly calendar: CalendarService) {}

  async execute(args: Record<string, unknown>, _context?: ToolContext): Promise<string> {
    const id = String(args.id ?? '');
    if (!id) return 'Error: "id" is required';
    const action = String(args.action ?? 'update');
    try {
      if (action === 'delete') {
        await this.calendar.deleteEvent(id);
        return `Event ${id} deleted.`;
      }
      const event = await this.calendar.updateEvent(id, {
        title: args.title ? String(args.title) : undefined,
        startTime: args.startTime ? String(args.startTime) : undefined,
        endTime: args.endTime ? String(args.endTime) : undefined,
        description: args.description ? String(args.description) : undefined,
      });
      return `Event updated: ${event.title}`;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
