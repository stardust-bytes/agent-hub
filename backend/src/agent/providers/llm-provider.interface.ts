import { Response } from 'express';

export interface LLMProvider {
  streamChat(
    message: string,
    model: string,
    res: Response,
    signal: AbortSignal,
  ): Promise<void>;
}
