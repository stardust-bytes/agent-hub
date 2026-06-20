import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { AgentProfilesService } from './agent-profiles.service';
import { CreateAgentProfileDto } from './dto/create-agent-profile.dto';
import { UpdateAgentProfileDto } from './dto/update-agent-profile.dto';

@Controller('agent-profiles')
export class AgentProfilesController {
  constructor(private readonly service: AgentProfilesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateAgentProfileDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAgentProfileDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
