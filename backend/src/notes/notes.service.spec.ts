import { Test, TestingModule } from '@nestjs/testing'
import { NotesService } from './notes.service'
import { PrismaService } from '../prisma/prisma.service'
import { NotesGateway } from './notes.gateway'

const mockPrisma = {
  note: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}

const mockGateway = {
  emitCreated: jest.fn(),
  emitUpdated: jest.fn(),
  emitDeleted: jest.fn(),
}

describe('NotesService', () => {
  let service: NotesService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotesGateway, useValue: mockGateway },
      ],
    }).compile()
    service = module.get(NotesService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('findAll returns notes ordered by createdAt desc', async () => {
    mockPrisma.note.findMany.mockResolvedValue([])
    const result = await service.findAll()
    expect(result).toEqual([])
    expect(mockPrisma.note.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
    })
  })

  it('create creates a note and emits event', async () => {
    const dto = { title: 'Test', content: 'Content' }
    const created = { id: 1, ...dto, createdAt: new Date(), updatedAt: new Date() }
    mockPrisma.note.create.mockResolvedValue(created)
    const result = await service.create(dto)
    expect(result).toEqual(created)
    expect(mockGateway.emitCreated).toHaveBeenCalledWith(created)
  })

  it('update updates a note and emits event', async () => {
    const existing = { id: 1, title: 'Old', content: 'Old', createdAt: new Date(), updatedAt: new Date() }
    const updated = { ...existing, title: 'New' }
    mockPrisma.note.findUnique.mockResolvedValue(existing)
    mockPrisma.note.update.mockResolvedValue(updated)
    const result = await service.update(1, { title: 'New' })
    expect(result.title).toBe('New')
    expect(mockGateway.emitUpdated).toHaveBeenCalledWith(updated)
  })

  it('remove deletes a note and emits event', async () => {
    const existing = { id: 1, title: 'Test', content: 'C', createdAt: new Date(), updatedAt: new Date() }
    mockPrisma.note.findUnique.mockResolvedValue(existing)
    mockPrisma.note.delete.mockResolvedValue(existing)
    const result = await service.remove(1)
    expect(result.id).toBe(1)
    expect(mockGateway.emitDeleted).toHaveBeenCalledWith(1)
  })

  it('findOne throws on missing note', async () => {
    mockPrisma.note.findUnique.mockResolvedValue(null)
    await expect(service.findOne(999)).rejects.toThrow('Note 999 not found')
  })
})
