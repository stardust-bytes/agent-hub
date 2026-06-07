import { Controller, Post, Body, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AgentService } from './agent.service';
import { ChatDto } from './dto/chat.dto';

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('chat')
  async chatStream(
    @Body() dto: ChatDto,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const ctrl = new AbortController();
    req.on('close', () => ctrl.abort());

    try {
      await this.agentService.streamChat(dto.message, dto.model ?? 'llama3.2', res, ctrl.signal);
    } catch {
      res.write('data: {"error":"internal_error"}\n\n');
    } finally {
      res.end();
    }
  }
}
