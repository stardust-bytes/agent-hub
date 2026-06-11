import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';
import { SearchMemoryDto } from './dto/search-memory.dto';

@Controller('memories')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Get()
  findAll(@Query() dto: SearchMemoryDto) {
    return this.memoryService.findAll(dto);
  }

  @Get('context')
  getContext() {
    return this.memoryService.getContextMemories();
  }

  @Post()
  create(@Body() dto: CreateMemoryDto) {
    return this.memoryService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMemoryDto) {
    return this.memoryService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.memoryService.remove(id);
  }
}
