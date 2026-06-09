import { AgentState } from './agent-state.enum';

export interface StepRecord {
  step: number;
  type: 'thinking' | 'skill_load' | 'tool_call' | 'tool_result' | 'kb_search' | 'kb_result' | 'responding';
  content?: string;
  skillSlug?: string;
  toolSlug?: string;
  toolCallId?: string;
  args?: Record<string, unknown>;
  result?: unknown;
}

export class AgentRunState {
  step = 0;
  maxIterations: number;
  roomId: string;
  steps: StepRecord[] = [];
  startTime: number;
  currentState: AgentState = AgentState.PLANNING;

  constructor(maxIterations: number, roomId?: string) {
    this.maxIterations = maxIterations;
    this.roomId = roomId ?? '';
    this.startTime = Date.now();
  }

  get duration(): number {
    return Date.now() - this.startTime;
  }
}
