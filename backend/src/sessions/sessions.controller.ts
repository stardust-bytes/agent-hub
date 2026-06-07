import { Controller, Get, Post, Delete, Param, ParseIntPipe } from '@nestjs/common';
import { SessionsService } from './sessions.service';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  findAll() {
    return this.sessionsService.findAll();
  }

  @Post()
  create() {
    return this.sessionsService.create();
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
