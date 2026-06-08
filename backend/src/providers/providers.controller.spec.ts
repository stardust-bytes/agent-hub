import { Test, TestingModule } from '@nestjs/testing';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';

const mockService = {
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  addModel: jest.fn(),
  removeModel: jest.fn(),
  findAllModels: jest.fn(),
};

describe('ProvidersController', () => {
  let controller: ProvidersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProvidersController],
      providers: [{ provide: ProvidersService, useValue: mockService }],
    }).compile();
    controller = module.get<ProvidersController>(ProvidersController);
    jest.clearAllMocks();
  });

  it('GET /providers/models calls findAllModels', async () => {
    const flat = [{ id: 1, name: 'llama3.2', providerId: 1, providerName: 'Local' }];
    mockService.findAllModels.mockResolvedValue(flat);
    const result = await controller.getAllModels();
    expect(mockService.findAllModels).toHaveBeenCalled();
    expect(result).toEqual(flat);
  });

  it('GET /providers calls findAll', async () => {
    mockService.findAll.mockResolvedValue([]);
    const result = await controller.findAll();
    expect(mockService.findAll).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('POST /providers calls create with dto', async () => {
    const dto = { name: 'Local', type: 'ollama' };
    const created = { id: 1, ...dto };
    mockService.create.mockResolvedValue(created);
    const result = await controller.create(dto as any);
    expect(mockService.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(created);
  });

  it('PATCH /providers/:id calls update', async () => {
    const updated = { id: 1, name: 'Updated' };
    mockService.update.mockResolvedValue(updated);
    const result = await controller.update(1, { name: 'Updated' } as any);
    expect(mockService.update).toHaveBeenCalledWith(1, { name: 'Updated' });
    expect(result).toEqual(updated);
  });

  it('DELETE /providers/:id calls remove', async () => {
    mockService.remove.mockResolvedValue(undefined);
    await controller.remove(1);
    expect(mockService.remove).toHaveBeenCalledWith(1);
  });

  it('POST /providers/:id/models calls addModel', async () => {
    const model = { id: 10, providerId: 1, name: 'llama3.2' };
    mockService.addModel.mockResolvedValue(model);
    const result = await controller.addModel(1, { name: 'llama3.2' } as any);
    expect(mockService.addModel).toHaveBeenCalledWith(1, { name: 'llama3.2' });
    expect(result).toEqual(model);
  });

  it('DELETE /providers/:id/models/:modelId calls removeModel', async () => {
    mockService.removeModel.mockResolvedValue(undefined);
    await controller.removeModel(1, 10);
    expect(mockService.removeModel).toHaveBeenCalledWith(1, 10);
  });
});
