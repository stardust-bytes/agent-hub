import { Test } from '@nestjs/testing';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { Request, Response } from 'express';

describe('AgentController', () => {
  let controller: AgentController;
  const mockStreamChat = jest.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AgentController],
      providers: [{ provide: AgentService, useValue: { streamChat: mockStreamChat } }],
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
    await controller.chatStream({ message: 'hi', model: 'llama3.2', sessionId: 1 }, req, res);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
    expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
  });

  it('calls agentService.streamChat with message, model, sessionId, mode', async () => {
    const { req, res } = makeReqRes();
    await controller.chatStream({ message: 'hello', model: 'codestral', sessionId: 1, mode: 'agent' }, req, res);
    expect(mockStreamChat).toHaveBeenCalledWith(
      'hello', 'codestral', res, expect.any(Object), 1, 'agent',
    );
  });

  it('uses fallback model llama3.2 and mode agent when undefined', async () => {
    const { req, res } = makeReqRes();
    await controller.chatStream({ message: 'hi', sessionId: 1 }, req, res);
    expect(mockStreamChat).toHaveBeenCalledWith('hi', 'llama3.2', res, expect.any(Object), 1, 'agent');
  });

  it('binds req close event to abort controller', async () => {
    const { req, res } = makeReqRes();
    await controller.chatStream({ message: 'test', sessionId: 1 }, req, res);
    expect(req.on).toHaveBeenCalledWith('close', expect.any(Function));
  });

  it('calls res.end() after streaming completes', async () => {
    const { req, res } = makeReqRes();
    await controller.chatStream({ message: 'hi', sessionId: 1 }, req, res);
    expect(res.end).toHaveBeenCalled();
  });
});
