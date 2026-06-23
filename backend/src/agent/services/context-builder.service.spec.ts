import { Test } from '@nestjs/testing';
import { ContextBuilderService } from './context-builder.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ToolsService } from '../../tools/tools.service';
import { McpService } from '../mcp/mcp.service';
import { CoworkService } from '../../cowork/cowork.service';
import { ModePolicyService } from '../../mode-policy/mode-policy.service';
import { MemoryService } from '../../memory/memory.service';
import { SettingsService } from '../../settings/settings.service';
import { WorkspaceService } from '../../workspace/workspace.service';
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

  const mockMemoryService = {
    getContextMemories: jest.fn().mockResolvedValue('## Persistent Memory'),
  };

  const mockSettings = {
    get: jest.fn().mockImplementation((_key: string, fallback: string) => Promise.resolve(fallback)),
  };

  const mockWorkspace = {
    getAllowedPaths: jest.fn().mockReturnValue(['/tmp/workspace_data']),
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
        { provide: MemoryService, useValue: mockMemoryService },
        { provide: SettingsService, useValue: mockSettings },
        { provide: WorkspaceService, useValue: mockWorkspace },
      ],
    }).compile();
    service = module.get(ContextBuilderService);
    mockSettings.get.mockImplementation((_key: string, fallback: string) => Promise.resolve(fallback));
  });

  it('system prompt contains KB guidance for empty results', async () => {
    const runState = new AgentRunState(10);
    const context = await service.build(runState, 0);
    expect(context.systemPrompt).toContain(
      'If no results AND the question is about internal documents',
    );
  });

  it('injects cowork project path into system prompt', async () => {
    mockCowork.getProject.mockResolvedValue('/test/project');
    const runState = new AgentRunState(10);
    const context = await service.build(runState, 0);
    expect(context.systemPrompt).toContain('Current working project: /test/project');
    expect(context.systemPrompt).toContain('FILE CREATION RULES (CRITICAL):');
  });

  it('system prompt contains platform and environment info', async () => {
    const runState = new AgentRunState(10);
    const context = await service.build(runState, 0);
    expect(context.systemPrompt).toContain('System Environment:');
    expect(context.systemPrompt).toContain('Platform:');
  });

  it('build includes project path and tools when project is set', async () => {
    mockCowork.getProject.mockResolvedValue('/test/project');
    const runState = new AgentRunState(10);
    const context = await service.build(runState, 0);
    expect(context.systemPrompt).toContain('access to the following tools');
    expect(context.systemPrompt).toContain('Current working project: /test/project');
    expect(context.systemPrompt).toContain('System Environment:');
  });

  describe('agent.autoDispatch toggle', () => {
    const dispatchTools = [
      { name: 'spawn_subagent', description: 'spawn', parameters: '{}' },
      { name: 'delegate', description: 'delegate', parameters: '{}' },
      { name: 'web_search', description: 'search', parameters: '{}' },
    ];

    it('keeps spawn_subagent and delegate when the setting is unset (default true)', async () => {
      mockToolsService.findEnabled.mockResolvedValue(dispatchTools);
      const context = await service.build(new AgentRunState(10), 0);
      const names = context.tools.map(t => t.function.name);
      expect(names).toContain('spawn_subagent');
      expect(names).toContain('delegate');
    });

    it('keeps spawn_subagent and delegate when agent.autoDispatch is explicitly "true"', async () => {
      mockToolsService.findEnabled.mockResolvedValue(dispatchTools);
      mockSettings.get.mockImplementation((key: string, fallback: string) =>
        Promise.resolve(key === 'agent.autoDispatch' ? 'true' : fallback),
      );
      const context = await service.build(new AgentRunState(10), 0);
      const names = context.tools.map(t => t.function.name);
      expect(names).toContain('spawn_subagent');
      expect(names).toContain('delegate');
    });

    it('keeps dispatch tools (default-on) when the settings lookup throws', async () => {
      mockToolsService.findEnabled.mockResolvedValue(dispatchTools);
      mockSettings.get.mockRejectedValue(new Error('settings unavailable'));
      const context = await service.build(new AgentRunState(10), 0);
      const names = context.tools.map(t => t.function.name);
      expect(names).toContain('spawn_subagent');
      expect(names).toContain('delegate');
    });

    it('removes spawn_subagent and delegate when agent.autoDispatch is "false"', async () => {
      mockToolsService.findEnabled.mockResolvedValue(dispatchTools);
      mockSettings.get.mockImplementation((key: string, fallback: string) =>
        Promise.resolve(key === 'agent.autoDispatch' ? 'false' : fallback),
      );
      const context = await service.build(new AgentRunState(10), 0);
      const names = context.tools.map(t => t.function.name);
      expect(names).not.toContain('spawn_subagent');
      expect(names).not.toContain('delegate');
      expect(names).toContain('web_search');
    });
  });
});
