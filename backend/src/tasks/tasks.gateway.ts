import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Task } from '@prisma/client';

@WebSocketGateway({
  namespace: '/tasks',
  cors: { origin: ['http://localhost:17135', 'http://localhost:3000'] },
})
export class TasksGateway {
  @WebSocketServer() server: Server;

  emitCreated(task: Task): void {
    this.server.emit('task:created', task);
  }

  emitUpdated(task: Task): void {
    this.server.emit('task:updated', task);
  }

  emitDeleted(id: number): void {
    this.server.emit('task:deleted', { id });
  }
}
