import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WorkspaceService } from './workspace.service';
import * as path from 'path';
import * as os from 'os';

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  const workspaceRoot = path.resolve('./workspace_data');

  async function createService(envOverrides?: Record<string, string>) {
    const env = { ...process.env };
    if (envOverrides) Object.assign(process.env, envOverrides);
    const module = await Test.createTestingModule({
      providers: [
        WorkspaceService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('./workspace_data') } },
      ],
    }).compile();
    if (envOverrides) process.env = env;
    return module.get<WorkspaceService>(WorkspaceService);
  }

  beforeEach(async () => {
    delete process.env.ALLOWED_PATHS;
    delete process.env.USERPROFILE;
    delete process.env.HOME;
    service = await createService();
  });

  it('getWorkspaceRoot returns resolved workspace path', () => {
    expect(service.getWorkspaceRoot()).toBe(workspaceRoot);
  });

  it('isPathAllowed allows workspace root', () => {
    expect(service.isPathAllowed(workspaceRoot)).toBe(true);
  });

  it('isPathAllowed allows path inside workspace root', () => {
    expect(service.isPathAllowed(path.join(workspaceRoot, 'uploads', 'test.txt'))).toBe(true);
  });

  it('isPathAllowed rejects path outside workspace root', () => {
    expect(service.isPathAllowed(path.resolve(os.tmpdir(), '..', 'outside.txt'))).toBe(false);
  });

  it('isPathAllowed rejects process.cwd() by default', () => {
    expect(service.isPathAllowed(process.cwd())).toBe(false);
  });

  it('isPathAllowed allows temp dir', () => {
    expect(service.isPathAllowed(os.tmpdir())).toBe(true);
  });

  it('isPathAllowed allows extra paths from ALLOWED_PATHS env', async () => {
    const svc = await createService({ ALLOWED_PATHS: '/custom/allowed' });
    expect(svc.isPathAllowed('/custom/allowed')).toBe(true);
    expect(svc.isPathAllowed('/custom/allowed/sub/file.ts')).toBe(true);
  });
});
