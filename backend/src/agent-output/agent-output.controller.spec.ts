import { Test, TestingModule } from '@nestjs/testing';
import { AgentOutputController } from './agent-output.controller';
import { WorkspaceService } from '../workspace/workspace.service';

describe('AgentOutputController', () => {
  let controller: AgentOutputController;
  let workspace: WorkspaceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentOutputController],
      providers: [
        {
          provide: WorkspaceService,
          useValue: {
            getWorkspaceRoot: jest.fn().mockReturnValue('/mock/workspace_data'),
            isPathAllowed: jest.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile();

    controller = module.get<AgentOutputController>(AgentOutputController);
    workspace = module.get<WorkspaceService>(WorkspaceService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listFiles', () => {
    it('should return file list from agent-output directory', async () => {
      const result = await controller.listFiles();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('download', () => {
    it('should throw NotFoundException for missing file', () => {
      expect(() => controller.download('nonexistent.docx', {} as any)).toThrow();
    });
  });
});
