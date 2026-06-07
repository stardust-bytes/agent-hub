import { Test } from '@nestjs/testing';
import { AppController } from './app.controller';
import { PrismaService } from './prisma/prisma.service';

const mockPrisma = {
  $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
};

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    controller = module.get<AppController>(AppController);
  });

  it('health returns ok status with db and timestamp', async () => {
    const result = await controller.health();
    expect(result.status).toBe('ok');
    expect(result.db).toBe('connected');
    expect(result.timestamp).toBeDefined();
  });
});
