import { Test } from '@nestjs/testing';
import { ContextBuilderService } from './context-builder.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ToolsService } from '../../tools/tools.service';
import { AgentRunState } from '../dto/agent-run-state';

describe('ContextBuilderService', () => {
  let service: ContextBuilderService;

  const mockPrisma = {
    chatMessage: { findMany: jest.fn().mockResolvedValue([]) },
    tool: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const mockToolsService = {
    findEnabled: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ContextBuilderService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ToolsService, useValue: mockToolsService },
      ],
    }).compile();
    service = module.get(ContextBuilderService);
  });

  it('system prompt contains KB guidance for empty results', async () => {
    const runState = new AgentRunState(10);
    const context = await service.build(runState, 0);
    expect(context.systemPrompt).toContain(
      'If no results AND the question is about internal documents',
    );
  });

  it('system prompt contains platform and environment info', async () => {
    const runState = new AgentRunState(10);
    const context = await service.build(runState, 0);
    expect(context.systemPrompt).toContain('System Environment:');
    expect(context.systemPrompt).toContain('Platform:');
    expect(context.systemPrompt).toContain('Current Working Directory:');
    expect(context.systemPrompt).toContain('User Home:');
  });
});
