import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Memory } from '@prisma/client';

@WebSocketGateway({
  namespace: '/memories',
  cors: { origin: ['http://localhost:17135'] },
})
export class MemoryGateway {
  @WebSocketServer() server: Server;

  emitCreated(memory: Memory): void {
    this.server.emit('memory:created', memory);
  }

  emitUpdated(memory: Memory): void {
    this.server.emit('memory:updated', memory);
  }

  emitDeleted(id: string): void {
    this.server.emit('memory:deleted', { id });
  }
}
