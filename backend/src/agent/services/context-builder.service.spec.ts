import { Test } from '@nestjs/testing';
import { ContextBuilderService } from './context-builder.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ToolsService } from '../../tools/tools.service';
import { McpService } from '../mcp/mcp.service';
import { CoworkService } from '../../cowork/cowork.service';
import { ModePolicyService } from '../../mode-policy/mode-policy.service';
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

  const mockMcpService = {
    getAllTools: jest.fn().mockResolvedValue([]),
  };

  const mockCowork = {
    getProject: jest.fn().mockResolvedValue(null),
  };

  const mockModePolicy = {
    getEnabledTools: jest.fn().mockImplementation((mode, dbTools) =>
      dbTools.map(t => ({
        type: 'function' as const,
        function: { name: t.name, description: t.description, parameters: JSON.parse(t.parameters) },
      }))
    ),
    resolveAllowedPaths: jest.fn().mockReturnValue(['/tmp/workspace/agent-output']),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ContextBuilderService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ToolsService, useValue: mockToolsService },
        { provide: McpService, useValue: mockMcpService },
        { provide: CoworkService, useValue: mockCowork },
        { provide: ModePolicyService, useValue: mockModePolicy },
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

  it('injects cowork project path into system prompt in cowork mode', async () => {
    mockCowork.getProject.mockResolvedValue('/test/project');
    const runState = new AgentRunState(10);
    const context = await service.build(runState, 0, 'cowork');
    expect(context.systemPrompt).toContain('Current working project: /test/project');
    expect(context.systemPrompt).toContain('File operations are available in this directory.');
  });

  it('does not include project path in agent mode even when project is set', async () => {
    mockCowork.getProject.mockResolvedValue('/test/project');
    const runState = new AgentRunState(10);
    const context = await service.build(runState, 0, 'agent');
    expect(context.systemPrompt).toContain('access to the following tools');
    expect(context.systemPrompt).not.toContain('Current working project:');
  });

  it('injects agent output path into system prompt in agent mode', async () => {
    const runState = new AgentRunState(10);
    const context = await service.build(runState, 0, 'agent');
    expect(context.systemPrompt).toContain('When writing files, use relative paths');
    expect(context.systemPrompt).toContain('agent-output');
    expect(context.systemPrompt).toContain('downloadable via links');
  });

  it('does not inject agent output path in chat mode', async () => {
    const runState = new AgentRunState(10);
    const context = await service.build(runState, 0, 'chat');
    expect(context.systemPrompt).not.toContain('agent-output');
  });

  it('system prompt contains platform and environment info in agent mode', async () => {
    const runState = new AgentRunState(10);
    const context = await service.build(runState, 0);
    expect(context.systemPrompt).toContain('System Environment:');
    expect(context.systemPrompt).toContain('Platform:');
  });

  it('build with mode=chat returns simple prompt without tool descriptions', async () => {
    const runState = new AgentRunState(10);
    const context = await service.build(runState, 0, 'chat');
    expect(context.systemPrompt).not.toContain('access to the following tools');
    expect(context.systemPrompt).not.toContain('System Environment:');
    expect(context.systemPrompt).toContain('You are a helpful AI assistant.');
  });

  it('build with mode=cowork includes project path and tools when project is set', async () => {
    mockCowork.getProject.mockResolvedValue('/test/project');
    const runState = new AgentRunState(10);
    const context = await service.build(runState, 0, 'cowork');
    expect(context.systemPrompt).toContain('access to the following tools');
    expect(context.systemPrompt).toContain('Current working project: /test/project');
    expect(context.systemPrompt).toContain('System Environment:');
  });
});
