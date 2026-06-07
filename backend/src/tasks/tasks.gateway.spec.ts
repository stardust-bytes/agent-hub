import { TasksGateway } from './tasks.gateway';
import { Server } from 'socket.io';
import { Task } from '@prisma/client';

describe('TasksGateway', () => {
  let gateway: TasksGateway;
  const mockEmit = jest.fn();

  beforeEach(() => {
    gateway = new TasksGateway();
    (gateway as any).server = { emit: mockEmit } as unknown as Server;
    jest.clearAllMocks();
  });

  const mockTask: Task = {
    id: 1,
    title: 'Test task',
    description: null,
    status: 'TODO',
    priority: 0,
    dueDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('emitCreated emits task:created with task', () => {
    gateway.emitCreated(mockTask);
    expect(mockEmit).toHaveBeenCalledWith('task:created', mockTask);
  });

  it('emitUpdated emits task:updated with task', () => {
    gateway.emitUpdated(mockTask);
    expect(mockEmit).toHaveBeenCalledWith('task:updated', mockTask);
  });

  it('emitDeleted emits task:deleted with id object', () => {
    gateway.emitDeleted(5);
    expect(mockEmit).toHaveBeenCalledWith('task:deleted', { id: 5 });
  });
});
