import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface PendingApproval {
  resolve: (value: boolean) => void;
  timer: ReturnType<typeof setTimeout>;
}

@Injectable()
export class ApprovalManagerService {
  private pending = new Map<string, PendingApproval>();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async requestApproval(
    toolCallId: string,
    toolName: string,
    args: Record<string, unknown>,
    sessionId: number,
  ): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(toolCallId);
        resolve(false);
      }, 30_000);

      this.pending.set(toolCallId, { resolve, timer });

      this.eventEmitter.emit('tool.approval.requested', {
        toolCallId,
        toolName,
        args,
        sessionId,
      });
    });
  }

  handleResponse(toolCallId: string, approved: boolean): boolean {
    const entry = this.pending.get(toolCallId);
    if (!entry) return false;
    clearTimeout(entry.timer);
    entry.resolve(approved);
    this.pending.delete(toolCallId);
    return true;
  }
}
