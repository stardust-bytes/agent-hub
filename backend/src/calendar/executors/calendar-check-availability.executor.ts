import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from '../../tools/executors/tool-executor.interface';
import { CalendarService } from '../calendar.service';

@Injectable()
export class CalendarCheckAvailabilityExecutor implements ToolExecutor {
  readonly name = 'calendar_check_availability';
  constructor(private readonly calendar: CalendarService) {}

  async execute(args: Record<string, unknown>, _context?: ToolContext): Promise<string> {
    const startTime = String(args.startTime ?? '');
    const endTime = String(args.endTime ?? '');
    if (!startTime) return 'Error: "startTime" is required';
    if (!endTime) return 'Error: "endTime" is required';
    try {
      const result = await this.calendar.checkAvailability(startTime, endTime);
      if (result.available) return 'Time slot is available.';
      return `Time slot has ${result.conflicts?.length || 0} conflict(s):\n${result.conflicts?.map(e => `- ${e.title} (${e.startTime} - ${e.endTime})`).join('\n')}`;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
