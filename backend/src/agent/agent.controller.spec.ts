import { Test } from '@nestjs/testing';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { Request, Response } from 'express';

describe('AgentController', () => {
  let controller: AgentController;
  const mockStreamChat = jest.fn().mockResolvedValue(undefined);
  const mockAgentService = {
    streamChat: mockStreamChat,
    executePlan: jest.fn().mockResolvedValue(undefined),
    getPermissions: jest.fn(),
    updatePermissions: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AgentController],
      providers: [{ provide: AgentService, useValue: mockAgentService }],
    }).compile();
    controller = module.get(AgentController);
    jest.clearAllMocks();
  });

  function makeReqRes() {
    const req = { on: jest.fn() } as unknown as Request;
    const res = {
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      end: jest.fn(),
    } as unknown as Response;
    return { req, res };
  }

  it('sets SSE headers', async () => {
    const { req, res } = makeReqRes();
    await controller.chatStream({ message: 'hi', providerModelId: 5, sessionId: 1 }, req, res);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
    expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
  });

  it('calls agentService.streamChat with message, providerModelId, sessionId, mode', async () => {
    const { req, res } = makeReqRes();
    await controller.chatStream({ message: 'hello', providerModelId: 5, sessionId: 1, mode: 'agent' }, req, res);
    expect(mockStreamChat).toHaveBeenCalledWith(
      'hello', 5, res, expect.any(Object), 1, 'agent',
    );
  });

  it('binds req close event to abort controller', async () => {
    const { req, res } = makeReqRes();
    await controller.chatStream({ message: 'test', providerModelId: 5, sessionId: 1 }, req, res);
    expect(req.on).toHaveBeenCalledWith('close', expect.any(Function));
  });

  it('calls res.end() after streaming completes', async () => {
    const { req, res } = makeReqRes();
    await controller.chatStream({ message: 'hi', providerModelId: 5, sessionId: 1 }, req, res);
    expect(res.end).toHaveBeenCalled();
  });

  describe('POST /agent/plans/:id/execute', () => {
    it('sets SSE headers', async () => {
      const { req, res } = makeReqRes();
      await controller.executePlanStream(42, { providerModelId: 5, sessionId: 1 }, req, res);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(res.end).toHaveBeenCalled();
    });

    it('calls agentService.executePlan with planId, providerModelId, sessionId', async () => {
      const { req, res } = makeReqRes();
      await controller.executePlanStream(42, { providerModelId: 5, sessionId: 1 }, req, res);
      expect(mockAgentService.executePlan).toHaveBeenCalledWith(42, 5, 1, expect.any(AbortSignal), res);
    });
  });
});
