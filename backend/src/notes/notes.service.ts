import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { NotesGateway } from './notes.gateway'
import { CreateNoteDto } from './dto/create-note.dto'
import { UpdateNoteDto } from './dto/update-note.dto'

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotesGateway,
  ) {}

  findAll() {
    return this.prisma.note.findMany({ orderBy: { createdAt: 'desc' } })
  }

  async create(dto: CreateNoteDto) {
    const note = await this.prisma.note.create({ data: dto })
    this.gateway.emitCreated(note)
    return note
  }

  async update(id: number, dto: UpdateNoteDto) {
    await this.findOneOrFail(id)
    const note = await this.prisma.note.update({ where: { id }, data: dto })
    this.gateway.emitUpdated(note)
    return note
  }

  async remove(id: number) {
    await this.findOneOrFail(id)
    const note = await this.prisma.note.delete({ where: { id } })
    this.gateway.emitDeleted(note.id)
    return note
  }

  async findOne(id: number) {
    const note = await this.prisma.note.findUnique({ where: { id } })
    if (!note) throw new NotFoundException(`Note ${id} not found`)
    return note
  }

  private async findOneOrFail(id: number) {
    return this.findOne(id)
  }
}
