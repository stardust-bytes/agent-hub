import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SessionsService', () => {
  let service: SessionsService;

  const mockPrisma = {
    session: {
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    chatMessage: {
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(SessionsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a session with default title', async () => {
      mockPrisma.session.create.mockResolvedValue({ id: 1, title: 'New Session' });
      const result = await service.create();
      expect(mockPrisma.session.create).toHaveBeenCalledWith({ data: { mode: 'cowork' } });
      expect(result.id).toBe(1);
    });
  });

  describe('findAll', () => {
    it('returns sessions ordered by updatedAt desc with message count', async () => {
      mockPrisma.session.findMany.mockResolvedValue([]);
      await service.findAll();
      expect(mockPrisma.session.findMany).toHaveBeenCalledWith({
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { messages: true } } },
      });
    });
  });

  describe('remove', () => {
    it('deletes session by id', async () => {
      mockPrisma.session.delete.mockResolvedValue({ id: 2 });
      const result = await service.remove(2);
      expect(mockPrisma.session.delete).toHaveBeenCalledWith({ where: { id: 2 } });
      expect(result).toEqual({ id: 2 });
    });
  });

  describe('getMessages', () => {
    it('returns messages for a session ordered by createdAt asc', async () => {
      const msgs = [{ id: 1, sessionId: 1, role: 'user', content: 'hi', createdAt: new Date() }];
      mockPrisma.session.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.chatMessage.findMany.mockResolvedValue(msgs);
      const result = await service.getMessages(1);
      expect(result).toEqual(msgs);
      expect(mockPrisma.chatMessage.findMany).toHaveBeenCalledWith({
        where: { sessionId: 1 },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('throws NotFoundException when session does not exist', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);
      await expect(service.getMessages(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getHistory', () => {
    it('returns OllamaMessage array from chat messages', async () => {
      mockPrisma.chatMessage.findMany.mockResolvedValue([
        { id: 1, role: 'user', content: 'Hello', sessionId: 1, createdAt: new Date() },
        { id: 2, role: 'assistant', content: 'Hi there', sessionId: 1, createdAt: new Date() },
      ]);
      const result = await service.getHistory(1);
      expect(result).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ]);
    });
  });

  describe('saveMessage', () => {
    it('creates a ChatMessage record with role and content', async () => {
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 1 });
      await service.saveMessage(1, 'user', 'test message');
      expect(mockPrisma.chatMessage.create).toHaveBeenCalledWith({
        data: { sessionId: 1, role: 'user', content: 'test message' },
      });
    });

    it('creates a ChatMessage record with toolName and isResult', async () => {
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 2 });
      await service.saveMessage(1, 'tool', 'create_task({"title":"x"})', 'create_task', false);
      expect(mockPrisma.chatMessage.create).toHaveBeenCalledWith({
        data: { sessionId: 1, role: 'tool', content: 'create_task({"title":"x"})', toolName: 'create_task', isResult: false },
      });
    });
  });

  describe('autoTitle', () => {
    it('sets title from first 5 words when user message count is 1', async () => {
      mockPrisma.chatMessage.count.mockResolvedValue(1);
      mockPrisma.session.update.mockResolvedValue({});
      await service.autoTitle(1, 'Create a new task for me today');
      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { title: 'Create a new task for' },
      });
    });

    it('does nothing when message count is greater than 1', async () => {
      mockPrisma.chatMessage.count.mockResolvedValue(2);
      await service.autoTitle(1, 'another message');
      expect(mockPrisma.session.update).not.toHaveBeenCalled();
    });
  });
});
