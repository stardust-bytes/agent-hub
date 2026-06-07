import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { OllamaService } from './ollama.service';

describe('OllamaService', () => {
  let service: OllamaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OllamaService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://localhost:11434') },
        },
      ],
    }).compile();
    service = module.get(OllamaService);
  });

  afterEach(() => jest.restoreAllMocks());

  it('getModels returns model name strings', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ models: [{ name: 'llama3.2' }, { name: 'codestral' }] }),
    } as unknown as Response);

    const models = await service.getModels();
    expect(models).toEqual(['llama3.2', 'codestral']);
  });

  it('getModels throws ServiceUnavailableException when Ollama offline', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.getModels()).rejects.toThrow(ServiceUnavailableException);
  });

  it('getModels throws ServiceUnavailableException when Ollama returns non-ok', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
    } as unknown as Response);

    await expect(service.getModels()).rejects.toThrow(ServiceUnavailableException);
  });
});
