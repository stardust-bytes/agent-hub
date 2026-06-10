import { Test, TestingModule } from '@nestjs/testing';
import { CoworkService } from './cowork.service';
import { SettingsService } from '../settings/settings.service';
import { WorkspaceService } from '../workspace/workspace.service';
import * as path from 'path';

describe('CoworkService', () => {
  let service: CoworkService;
  const mockSettings = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const mockWorkspace = {
    addAllowedPath: jest.fn(),
    isPathAllowed: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoworkService,
        { provide: SettingsService, useValue: mockSettings },
        { provide: WorkspaceService, useValue: mockWorkspace },
      ],
    }).compile();
    service = module.get<CoworkService>(CoworkService);
  });

  it('setProject persists path and adds to allowed paths', async () => {
    const resolved = path.resolve('/test/project');
    await service.setProject('/test/project');
    expect(mockSettings.set).toHaveBeenCalledWith('cowork_project_path', resolved);
    expect(mockWorkspace.addAllowedPath).toHaveBeenCalledWith(resolved);
  });

  it('getProject reads from settings', async () => {
    mockSettings.get.mockResolvedValue('/saved/path');
    const result = await service.getProject();
    expect(result).toBe('/saved/path');
  });

  it('clearProject removes from settings', async () => {
    await service.clearProject();
    expect(mockSettings.delete).toHaveBeenCalledWith('cowork_project_path');
  });

  it('getStatus returns project info', async () => {
    mockSettings.get.mockResolvedValue('/test/project');
    const status = await service.getStatus();
    expect(status.projectPath).toBe('/test/project');
    expect(status.isActive).toBe(true);
  });

  it('getStatus returns inactive when no project', async () => {
    mockSettings.get.mockResolvedValue(null);
    const status = await service.getStatus();
    expect(status.isActive).toBe(false);
    expect(status.projectPath).toBeNull();
  });
});
