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

  it('onModuleInit restores saved project path to allowed paths', async () => {
    const savedMock = { ...mockSettings, get: jest.fn().mockResolvedValue('/saved/path') };
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        CoworkService,
        { provide: SettingsService, useValue: savedMock },
        { provide: WorkspaceService, useValue: mockWorkspace },
      ],
    }).compile();
    const svc = mod.get<CoworkService>(CoworkService);
    jest.clearAllMocks();
    await svc.onModuleInit();
    expect(mockWorkspace.addAllowedPath).toHaveBeenCalledWith('/saved/path');
  });

  it('onModuleInit does nothing when no saved path', async () => {
    await service.onModuleInit();
    expect(mockWorkspace.addAllowedPath).not.toHaveBeenCalled();
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

  describe('getDrives', () => {
    it('returns an array of drive strings', async () => {
      const drives = await service.getDrives();
      expect(Array.isArray(drives)).toBe(true);
      expect(drives.length).toBeGreaterThan(0);
      expect(drives[0]).toMatch(/^[a-zA-Z]:\\$|^\/$/);
    });
  });

  describe('browseDirectory', () => {
    it('returns entries for a valid directory', async () => {
      const result = await service.browseDirectory(process.cwd());
      expect(result.path).toBe(process.cwd());
      expect(Array.isArray(result.entries)).toBe(true);
      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries[0]).toHaveProperty('name');
      expect(result.entries[0]).toHaveProperty('isDirectory');
    });

    it('throws for non-existent path', async () => {
      await expect(service.browseDirectory('Z:\\__nonexistent__')).rejects.toThrow();
    });

    it('only returns directories', async () => {
      const result = await service.browseDirectory(process.cwd());
      for (const entry of result.entries) {
        expect(entry.isDirectory).toBe(true);
      }
    });
  });
});
