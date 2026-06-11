import { Test, TestingModule } from '@nestjs/testing';
import { MemoryGateway } from './memory.gateway';

describe('MemoryGateway', () => {
  let gateway: MemoryGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MemoryGateway],
    }).compile();

    gateway = module.get<MemoryGateway>(MemoryGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
