import { AgentProfilesService } from './agent-profiles.service';

describe('AgentProfilesService', () => {
  const builtin = { id: 1, slug: 'researcher', builtin: true };
  let prisma: any;
  let service: AgentProfilesService;

  beforeEach(() => {
    prisma = {
      agentProfile: {
        findMany: jest.fn().mockResolvedValue([builtin]),
        findUnique: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => ({ id: 2, ...data })),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new AgentProfilesService(prisma);
  });

  it('finds a profile by slug', async () => {
    prisma.agentProfile.findUnique.mockResolvedValue(builtin);
    expect(await service.findBySlug('researcher')).toEqual(builtin);
    expect(prisma.agentProfile.findUnique).toHaveBeenCalledWith({ where: { slug: 'researcher' } });
  });

  it('refuses to delete a builtin profile', async () => {
    prisma.agentProfile.findUnique.mockResolvedValue(builtin);
    await expect(service.remove(1)).rejects.toThrow('profile_builtin_readonly');
    expect(prisma.agentProfile.delete).not.toHaveBeenCalled();
  });

  it('deletes a non-builtin profile', async () => {
    prisma.agentProfile.findUnique.mockResolvedValue({ id: 3, builtin: false });
    await service.remove(3);
    expect(prisma.agentProfile.delete).toHaveBeenCalledWith({ where: { id: 3 } });
  });
});
