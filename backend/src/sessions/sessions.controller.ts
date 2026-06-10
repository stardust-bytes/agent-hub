import { Controller, Get, Post, Delete, Param, ParseIntPipe, Query, Body } from '@nestjs/common';
import { SessionsService } from './sessions.service';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  findAll(@Query('mode') mode?: string) {
    return this.sessionsService.findAll(mode);
  }

  @Post()
  create(@Body('mode') mode?: string) {
    return this.sessionsService.create(mode ?? 'chat');
  }

  @Delete()
  removeAll() {
    return this.sessionsService.removeAll();
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.sessionsService.remove(id);
  }

  @Get(':id/messages')
  getMessages(@Param('id', ParseIntPipe) id: number) {
    return this.sessionsService.getMessages(id);
  }
}
