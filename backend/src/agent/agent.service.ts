import { Injectable } from '@nestjs/common';

@Injectable()
export class AgentService {
  mockReply(message: string): string {
    return `[stub] Received: ${message}. Ollama integration coming in Phase 2.`;
  }
}
