import { Controller, Get, Post, Param, ParseIntPipe, HttpCode } from '@nestjs/common';
import { PlansService } from './plans.service';

@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get('session/:sessionId')
  getBySession(@Param('sessionId', ParseIntPipe) sessionId: number) {
    return this.plansService.findBySession(sessionId);
  }

  @Get(':id')
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.plansService.findOne(id);
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(@Param('id', ParseIntPipe) id: number) {
    return this.plansService.approve(id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(@Param('id', ParseIntPipe) id: number) {
    return this.plansService.reject(id);
  }

  @Get('session/:sessionId/next')
  getNextActionable(@Param('sessionId', ParseIntPipe) sessionId: number) {
    return this.plansService.findNextActionable(sessionId);
  }
}
