import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets'
import { Server } from 'socket.io'
import { Note } from '@prisma/client'

@WebSocketGateway({
  namespace: '/notes',
  cors: { origin: ['http://localhost:17135'] },
})
export class NotesGateway {
  @WebSocketServer()
  server: Server

  emitCreated(note: Note): void {
    this.server.emit('note:created', note)
  }

  emitUpdated(note: Note): void {
    this.server.emit('note:updated', note)
  }

  emitDeleted(id: number): void {
    this.server.emit('note:deleted', { id })
  }
}
