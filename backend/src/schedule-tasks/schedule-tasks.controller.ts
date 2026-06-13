import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe } from '@nestjs/common';
import { ScheduleTasksService } from './schedule-tasks.service';
import { CreateScheduleTaskDto } from './dto/create-schedule-task.dto';
import { UpdateScheduleTaskDto } from './dto/update-schedule-task.dto';

@Controller('schedule-tasks')
export class ScheduleTasksController {
  constructor(
    private readonly service: ScheduleTasksService,
  ) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Post()
  create(@Body() dto: CreateScheduleTaskDto) { return this.service.create(dto); }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateScheduleTaskDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }

  @Get(':id/logs')
  getLogs(@Param('id', ParseIntPipe) id: number) { return this.service.getLogs(id); }
}
