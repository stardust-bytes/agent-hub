import { Test } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { OllamaController } from './ollama.controller';
import { OllamaService } from './ollama.service';

describe('OllamaController', () => {
  let controller: OllamaController;
  const mockService = { getModels: jest.fn() };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [OllamaController],
      providers: [{ provide: OllamaService, useValue: mockService }],
    }).compile();
    controller = module.get(OllamaController);
    jest.clearAllMocks();
  });

  it('getModels returns string array from service', async () => {
    mockService.getModels.mockResolvedValue(['llama3.2', 'codestral']);
    const result = await controller.getModels();
    expect(result).toEqual(['llama3.2', 'codestral']);
  });

  it('getModels propagates ServiceUnavailableException', async () => {
    mockService.getModels.mockRejectedValue(new ServiceUnavailableException());
    await expect(controller.getModels()).rejects.toThrow(ServiceUnavailableException);
  });
});
