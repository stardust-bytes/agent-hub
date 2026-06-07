import { AgentService } from './agent.service';

describe('AgentService', () => {
  let service: AgentService;

  beforeEach(() => {
    service = new AgentService();
  });

  it('mockReply echoes message in stub format', () => {
    const reply = service.mockReply('hello world');
    expect(reply).toBe('[stub] Received: hello world. Ollama integration coming in Phase 2.');
  });

  it('mockReply handles empty string', () => {
    const reply = service.mockReply('');
    expect(reply).toBe('[stub] Received: . Ollama integration coming in Phase 2.');
  });
});
