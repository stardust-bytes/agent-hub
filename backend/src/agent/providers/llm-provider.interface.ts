import { Response } from 'express';

export interface LLMProvider {
  streamChat(
    message: string,
    model: string,
    res: Response,
    signal: AbortSignal,
    context?: string,
  ): Promise<void>;
}
