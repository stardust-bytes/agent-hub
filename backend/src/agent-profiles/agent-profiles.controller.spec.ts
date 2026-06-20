import { AgentProfilesController } from './agent-profiles.controller';

describe('AgentProfilesController', () => {
  const service = {
    findAll: jest.fn().mockResolvedValue([{ id: 1 }]),
    create: jest.fn().mockResolvedValue({ id: 2 }),
    update: jest.fn().mockResolvedValue({ id: 2 }),
    remove: jest.fn().mockResolvedValue({ id: 2 }),
  } as any;
  const controller = new AgentProfilesController(service);

  it('lists profiles', async () => {
    expect(await controller.findAll()).toEqual([{ id: 1 }]);
  });

  it('deletes by numeric id', async () => {
    await controller.remove(2 as any);
    expect(service.remove).toHaveBeenCalledWith(2);
  });
});
