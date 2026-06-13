import { Test, TestingModule } from '@nestjs/testing';
import { ApprovalManagerService } from './approval-manager.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('ApprovalManagerService', () => {
  let service: ApprovalManagerService;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalManagerService,
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = module.get<ApprovalManagerService>(ApprovalManagerService);
    eventEmitter = module.get(EventEmitter2);
  });

  it('approves a pending request', async () => {
    const promise = service.requestApproval('id1', 'run_command', { cmd: 'rm -rf' }, 1);
    const handled = service.handleResponse('id1', true);
    expect(handled).toBe(true);
    const result = await promise;
    expect(result).toBe(true);
  });

  it('denies a pending request', async () => {
    const promise = service.requestApproval('id2', 'run_command', { cmd: 'rm -rf' }, 1);
    service.handleResponse('id2', false);
    const result = await promise;
    expect(result).toBe(false);
  });

  it('returns false for unknown toolCallId', () => {
    const handled = service.handleResponse('unknown', true);
    expect(handled).toBe(false);
  });

  it('emits tool.approval.requested event on request', () => {
    service.requestApproval('id5', 'run_command', { cmd: 'ls' }, 1);
    expect(eventEmitter.emit).toHaveBeenCalledWith('tool.approval.requested', {
      toolCallId: 'id5',
      toolName: 'run_command',
      args: { cmd: 'ls' },
      sessionId: 1,
    });
  });
});
