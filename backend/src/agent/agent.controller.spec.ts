import { Test, TestingModule } from '@nestjs/testing';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';

const mockService = {
  mockReply: jest.fn().mockReturnValue('[stub] Received: hi. Ollama integration coming in Phase 2.'),
};

describe('AgentController', () => {
  let controller: AgentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentController],
      providers: [{ provide: AgentService, useValue: mockService }],
    }).compile();
    controller = module.get<AgentController>(AgentController);
    jest.clearAllMocks();
  });

  it('chat returns reply and timestamp', async () => {
    mockService.mockReply.mockReturnValue('[stub] Received: hi.');
    const result = await controller.chat({ message: 'hi' });
    expect(result.reply).toBe('[stub] Received: hi.');
    expect(result.timestamp).toBeDefined();
    expect(mockService.mockReply).toHaveBeenCalledWith('hi');
  });
});
