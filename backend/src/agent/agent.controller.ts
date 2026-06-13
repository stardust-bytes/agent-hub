import { Body, Controller, Get, Patch, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AgentService } from './agent.service';
import { ApproveToolDto } from './dto/approve-tool.dto';
import { ChatDto } from './dto/chat.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
import { PermissionsConfig } from './dto/permissions-config';
import { YoloClassifierService } from './services/yolo-classifier.service';
import { UpdateYoloConfigDto } from './dto/yolo-config.dto';
import { ApprovalManagerService } from './services/approval-manager.service';
@Controller('agent')
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly yoloClassifier: YoloClassifierService,
    private readonly approvalManager: ApprovalManagerService,
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
      await this.agentService.streamChat(dto.message, dto.providerModelId, res, ctrl.signal, dto.sessionId);
    } catch (e) {
      console.error('[AgentController] chat error:', e instanceof Error ? e.message : e);
      res.write('data: {"error":"internal_error"}\n\n');
    } finally {
      res.end();
    }
  }

  @Post('approve-tool')
  async approveTool(@Body() dto: ApproveToolDto): Promise<{ success: boolean }> {
    const handled = this.approvalManager.handleResponse(dto.id, dto.approved);
    return { success: handled };
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
