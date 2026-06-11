import { Controller, Post, Get, Patch, Body, Req, Res, Param, ParseIntPipe } from '@nestjs/common';
import { Request, Response } from 'express';
import { AgentService } from './agent.service';
import { ChatDto } from './dto/chat.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
import { PermissionsConfig } from './dto/permissions-config';
import { YoloClassifierService } from './services/yolo-classifier.service';
import { UpdateYoloConfigDto } from './dto/yolo-config.dto';
@Controller('agent')
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly yoloClassifier: YoloClassifierService,
  ) {}

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
      await this.agentService.streamChat(dto.message, dto.providerModelId, res, ctrl.signal, dto.sessionId, dto.mode ?? 'agent');
    } catch {
      res.write('data: {"error":"internal_error"}\n\n');
    } finally {
      res.end();
    }
  }

  @Get('permissions')
  async getPermissions(): Promise<PermissionsConfig> {
    return this.agentService.getPermissions();
  }

  @Patch('permissions')
  async updatePermissions(@Body() dto: UpdatePermissionsDto): Promise<PermissionsConfig> {
    return this.agentService.updatePermissions(dto);
  }

  @Get('yolo-config')
  async getYoloConfig() {
    return this.yoloClassifier.getConfig();
  }

  @Patch('yolo-config')
  async updateYoloConfig(@Body() dto: UpdateYoloConfigDto) {
    return this.yoloClassifier.updateConfig(dto);
  }
}
