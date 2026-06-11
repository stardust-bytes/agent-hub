import { Injectable } from '@nestjs/common';
import { LLMControllerService } from './llm-controller.service';
import { BLOCK_RULES, matchDangerPattern, BlockRule } from './danger-patterns.config';
import { DenialTracker } from './denial-tracking';
import {
  YOLO_SYSTEM_PROMPT,
  STAGE1_PROMPT_SUFFIX,
  STAGE2_PROMPT_SUFFIX,
  STAGE1_MAX_TOKENS,
  STAGE2_MAX_TOKENS,
  SAFE_TOOL_ALLOWLIST,
} from './yolo-classifier.constants';
import { OllamaMessage } from '../providers/llm-provider.interface';

export interface YoloResult {
  allowed: boolean;
  reason?: string;
  stage: 'fast_path' | 'pattern' | 'stage1' | 'stage2' | 'error' | 'fallback';
  rule?: string;
}

export interface YoloConfig {
  disabledPatterns: string[];
  failClosed: boolean;
  safeToolAllowlist: boolean;
}

export const DEFAULT_YOLO_CONFIG: YoloConfig = {
  disabledPatterns: [],
  failClosed: true,
  safeToolAllowlist: true,
};

@Injectable()
export class YoloClassifierService {
  private trackers = new Map<string, DenialTracker>();
  private config: YoloConfig = { ...DEFAULT_YOLO_CONFIG };

  constructor(private readonly llmController: LLMControllerService) {}

  getConfig(): YoloConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<YoloConfig>): YoloConfig {
    this.config = { ...this.config, ...updates };
    return this.getConfig();
  }

  async evaluate(
    toolName: string,
    toolInput: string,
    transcript: string,
    sessionId?: number,
  ): Promise<YoloResult> {
    const sessionKey = sessionId?.toString() ?? 'default';
    let tracker = this.trackers.get(sessionKey);
    if (!tracker) {
      tracker = new DenialTracker();
      this.trackers.set(sessionKey, tracker);
    }

    if (tracker.isLimitExceeded()) {
      return { allowed: false, reason: 'Denial limit exceeded', stage: 'fallback' };
    }

    if (this.config.safeToolAllowlist && SAFE_TOOL_ALLOWLIST.includes(toolName)) {
      tracker.recordAllow();
      return { allowed: true, stage: 'fast_path' };
    }

    const activeRules = BLOCK_RULES.filter(r => !this.config.disabledPatterns.includes(r.category));
    const matched = matchDangerPattern(toolName, toolInput, activeRules);

    if (matched) {
      return this.runStage2(toolName, toolInput, transcript, tracker, matched);
    }

    return this.runStage1(toolName, toolInput, transcript, tracker);
  }

  private async runStage1(
    toolName: string,
    toolInput: string,
    transcript: string,
    tracker: DenialTracker,
  ): Promise<YoloResult> {
    const prompt = `${transcript}\n\nAction: ${toolName}(${toolInput})\n\n${STAGE1_PROMPT_SUFFIX}`;
    const messages: OllamaMessage[] = [
      { role: 'system', content: YOLO_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ];

    try {
      const response = await this.llmController.generateCompletion(messages, { max_tokens: STAGE1_MAX_TOKENS, temperature: 0 });

      const blockMatch = response.match(/<block>(yes|no)<\/block>/);
      if (!blockMatch) {
        return this.runStage2(toolName, toolInput, transcript, tracker);
      }

      if (blockMatch[1] === 'no') {
        tracker.recordAllow();
        return { allowed: true, stage: 'stage1' };
      }

      return this.runStage2(toolName, toolInput, transcript, tracker);
    } catch {
      if (this.config.failClosed) {
        return { allowed: false, reason: 'Classifier API error', stage: 'error' };
      }
      return { allowed: false, reason: 'Classifier unavailable', stage: 'fallback' };
    }
  }

  private async runStage2(
    toolName: string,
    toolInput: string,
    transcript: string,
    tracker: DenialTracker,
    matched?: BlockRule,
  ): Promise<YoloResult> {
    const prompt = `${transcript}\n\nAction: ${toolName}(${toolInput})\n${STAGE2_PROMPT_SUFFIX}`;
    const messages: OllamaMessage[] = [
      { role: 'system', content: YOLO_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ];

    try {
      const response = await this.llmController.generateCompletion(messages, { max_tokens: STAGE2_MAX_TOKENS, temperature: 0 });

      const blockMatch = response.match(/<block>(yes|no)<\/block>/);
      const reasonMatch = response.match(/<reason>([^<]+)<\/reason>/);

      if (!blockMatch || blockMatch[1] === 'yes') {
        const exceeded = tracker.recordDenial();
        return {
          allowed: false,
          reason: reasonMatch?.[1] ?? 'Blocked by classifier',
          stage: 'stage2',
          rule: matched?.category,
        };
      }

      tracker.recordAllow();
      return { allowed: true, stage: matched ? 'pattern' : 'stage2' };
    } catch {
      if (this.config.failClosed) {
        return { allowed: false, reason: 'Classifier API error', stage: 'error' };
      }
      return { allowed: false, reason: 'Classifier unavailable', stage: 'fallback' };
    }
  }
}
