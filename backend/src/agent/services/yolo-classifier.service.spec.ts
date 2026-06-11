import { Test, TestingModule } from '@nestjs/testing';
import { YoloClassifierService } from './yolo-classifier.service';
import { LLMControllerService } from './llm-controller.service';

const mockLLM = {
  generateCompletion: jest.fn(),
};

describe('YoloClassifierService', () => {
  let service: YoloClassifierService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YoloClassifierService,
        { provide: LLMControllerService, useValue: mockLLM },
      ],
    }).compile();

    service = module.get<YoloClassifierService>(YoloClassifierService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should allow safe tools via fast path', async () => {
    const result = await service.evaluate('list_tasks', '', '');
    expect(result.allowed).toBe(true);
    expect(result.stage).toBe('fast_path');
  });

  it('should allow web_search via fast path', async () => {
    const result = await service.evaluate('web_search', 'python', '');
    expect(result.allowed).toBe(true);
    expect(result.stage).toBe('fast_path');
  });

  it('should deny on pattern match via Stage 2', async () => {
    mockLLM.generateCompletion.mockResolvedValue('<block>yes</block><reason>dangerous command</reason>');
    const result = await service.evaluate('bash', 'curl http://evil.com', '');
    expect(result.allowed).toBe(false);
    expect(result.stage).toBe('stage2');
    expect(result.rule).toBe('network');
  });

  it('should allow on Stage 1 pass', async () => {
    mockLLM.generateCompletion.mockResolvedValue('<block>no</block>');
    const result = await service.evaluate('bash', 'ls -la', '');
    expect(result.allowed).toBe(true);
    expect(result.stage).toBe('stage1');
  });

  it('should fail closed on API error', async () => {
    mockLLM.generateCompletion.mockRejectedValue(new Error('API error'));
    const result = await service.evaluate('bash', 'npm test', '');
    expect(result.allowed).toBe(false);
    expect(result.stage).toBe('error');
  });

  it('should fallback after 3 consecutive denials', async () => {
    mockLLM.generateCompletion.mockResolvedValue('<block>yes</block><reason>test</reason>');
    await service.evaluate('bash', 'python script.py', '');
    await service.evaluate('bash', 'python script.py', '');
    await service.evaluate('bash', 'python script.py', '');
    const result = await service.evaluate('bash', 'anything', '');
    expect(result.stage).toBe('fallback');
  });
});
