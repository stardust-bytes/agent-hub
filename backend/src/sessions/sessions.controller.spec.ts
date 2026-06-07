import { Test, TestingModule } from '@nestjs/testing';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

const mockService = {
  findAll: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockResolvedValue({ id: 1, title: 'New Session' }),
  remove: jest.fn().mockResolvedValue({ id: 1 }),
  getMessages: jest.fn().mockResolvedValue([]),
};

describe('SessionsController', () => {
  let controller: SessionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [{ provide: SessionsService, useValue: mockService }],
    }).compile();
    controller = module.get<SessionsController>(SessionsController);
    jest.clearAllMocks();
  });

  it('findAll delegates to service', async () => {
    await controller.findAll();
    expect(mockService.findAll).toHaveBeenCalled();
  });

  it('create delegates to service', async () => {
    const result = await controller.create();
    expect(mockService.create).toHaveBeenCalled();
    expect(result).toEqual({ id: 1, title: 'New Session' });
  });

  it('remove passes parsed id to service', async () => {
    await controller.remove(42);
    expect(mockService.remove).toHaveBeenCalledWith(42);
  });

  it('getMessages passes parsed id to service', async () => {
    await controller.getMessages(7);
    expect(mockService.getMessages).toHaveBeenCalledWith(7);
  });
});
