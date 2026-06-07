import { Controller, Post, Body } from '@nestjs/common';
import { IsString } from 'class-validator';
import { AgentService } from './agent.service';

class ChatDto {
  @IsString()
  message: string;
}

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('chat')
  async chat(@Body() dto: ChatDto) {
    return {
      reply: this.agentService.mockReply(dto.message),
      timestamp: new Date().toISOString(),
    };
  }
}
