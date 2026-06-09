import { NotesGateway } from './notes.gateway'
import { Server } from 'socket.io'
import { Note } from '@prisma/client'

describe('NotesGateway', () => {
  let gateway: NotesGateway
  const mockEmit = jest.fn()

  beforeEach(() => {
    gateway = new NotesGateway()
    ;(gateway as any).server = { emit: mockEmit } as unknown as Server
    jest.clearAllMocks()
  })

  const mockNote: Note = {
    id: 1,
    title: 'Test note',
    content: 'Content',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  it('emitCreated emits note:created with note', () => {
    gateway.emitCreated(mockNote)
    expect(mockEmit).toHaveBeenCalledWith('note:created', mockNote)
  })

  it('emitUpdated emits note:updated with note', () => {
    gateway.emitUpdated(mockNote)
    expect(mockEmit).toHaveBeenCalledWith('note:updated', mockNote)
  })

  it('emitDeleted emits note:deleted with id object', () => {
    gateway.emitDeleted(5)
    expect(mockEmit).toHaveBeenCalledWith('note:deleted', { id: 5 })
  })
})
