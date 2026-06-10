import { Test, TestingModule } from '@nestjs/testing';
import { ModePolicyService } from './mode-policy.service';
import { ConfigService } from '@nestjs/config';

describe('ModePolicyService', () => {
  let service: ModePolicyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModePolicyService,
        { provide: ConfigService, useValue: { get: () => './workspace_data' } },
      ],
    }).compile();
    service = module.get<ModePolicyService>(ModePolicyService);
  });

  describe('getEnabledTools', () => {
    const mockTools = [
      { name: 'web_search', description: 'Search web', parameters: '{}' },
      { name: 'web_fetch', description: 'Fetch URL', parameters: '{}' },
      { name: 'write_file', description: 'Write file', parameters: '{}' },
      { name: 'run_command', description: 'Run command', parameters: '{}' },
      { name: 'read_file', description: 'Read file', parameters: '{}' },
    ];

    it('should return only web tools for chat mode', () => {
      const result = service.getEnabledTools('chat', mockTools);
      expect(result.length).toBe(2);
      expect(result.map(t => t.function.name).sort()).toEqual(['web_fetch', 'web_search']);
    });

    it('should exclude denied tools for agent mode', () => {
      const result = service.getEnabledTools('agent', mockTools);
      const names = result.map(t => t.function.name);
      expect(names).toContain('web_search');
      expect(names).toContain('write_file');
      expect(names).not.toContain('run_command');
      expect(names).not.toContain('read_file');
    });

    it('should return all tools for cowork mode', () => {
      const result = service.getEnabledTools('cowork', mockTools);
      expect(result.length).toBe(5);
    });

    it('should default to agent policy for unknown modes', () => {
      const result = service.getEnabledTools('unknown', mockTools);
      expect(result.map(t => t.function.name)).not.toContain('run_command');
    });
  });

  describe('resolveAllowedPaths', () => {
    it('should resolve workspaceRoot placeholder', () => {
      const result = service.resolveAllowedPaths('agent');
      expect(result[0]).toMatch(/workspace_data[\\/]agent-output/);
    });

    it('should resolve projectPath placeholder for cowork', () => {
      const result = service.resolveAllowedPaths('cowork', '/home/project');
      expect(result[0]).toBe('/home/project');
      expect(result[1]).toMatch(/workspace_data/);
    });

    it('should return empty paths for chat', () => {
      const result = service.resolveAllowedPaths('chat');
      expect(result).toEqual([]);
    });
  });

  describe('isToolAllowed', () => {
    it('should deny run_command in agent mode', () => {
      expect(service.isToolAllowed('agent', 'run_command')).toBe(false);
    });

    it('should allow write_file in agent mode', () => {
      expect(service.isToolAllowed('agent', 'write_file')).toBe(true);
    });

    it('should deny write_file in chat mode', () => {
      expect(service.isToolAllowed('chat', 'write_file')).toBe(false);
    });
  });
});
