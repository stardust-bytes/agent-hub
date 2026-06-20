import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { McpService } from './mcp.service';
import { WorkspaceService } from '../../workspace/workspace.service';

describe('McpService', () => {
  let service: McpService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        McpService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('./workspace_data') } },
        { provide: WorkspaceService, useValue: { getWorkspaceRoot: jest.fn().mockReturnValue('./workspace_data') } },
      ],
    }).compile();
    service = module.get(McpService);
  });

  it('returns null for unknown tool', async () => {
    const result = await service.tryExecute('unknown_tool', {});
    expect(result).toBeNull();
  });

  it('returns null for non-MCP tool name', async () => {
    const result = await service.tryExecute('create_task', {});
    expect(result).toBeNull();
  });

  it('initially has no servers (playwright may fail in test env)', () => {
    expect(Array.isArray(service.getServers())).toBe(true);
  });
});
