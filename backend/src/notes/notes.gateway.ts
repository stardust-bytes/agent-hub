import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets'
import { Server } from 'socket.io'
import { Note } from '@prisma/client'

@WebSocketGateway({ namespace: '/notes' })
export class NotesGateway {
  @WebSocketServer()
  server: Server

  emitCreated(note: Note) {
    this.server?.emit('note:created', note)
  }

  emitUpdated(note: Note) {
    this.server?.emit('note:updated', note)
  }

  emitDeleted(id: number) {
    this.server?.emit('note:deleted', { id })
  }
}
