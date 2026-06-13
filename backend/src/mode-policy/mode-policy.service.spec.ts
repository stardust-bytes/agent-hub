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

    it('should return all tools for cowork mode', () => {
      const result = service.getEnabledTools('cowork', mockTools);
      expect(result.length).toBe(5);
    });

    it('should default to cowork policy for unknown modes', () => {
      const result = service.getEnabledTools('unknown', mockTools);
      expect(result.length).toBe(5);
    });
  });

  describe('resolveAllowedPaths', () => {
    it('should resolve projectPath placeholder for cowork', () => {
      const result = service.resolveAllowedPaths('cowork', '/home/project');
      expect(result[0]).toBe('/home/project');
    });
  });


});
