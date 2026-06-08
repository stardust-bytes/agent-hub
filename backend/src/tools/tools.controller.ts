import { Controller, Get, Param, Patch, Body, NotFoundException } from '@nestjs/common';
import { ToolsService } from './tools.service';

@Controller('tools')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Get()
  findAll() {
    return this.toolsService.findAll();
  }

  @Patch(':name/toggle')
  async toggle(@Param('name') name: string) {
    try {
      return await this.toolsService.toggle(name);
    } catch {
      throw new NotFoundException(`Tool '${name}' not found`);
    }
  }

  @Patch(':name/config')
  async updateConfig(
    @Param('name') name: string,
    @Body() body: { config: Record<string, unknown> },
  ) {
    return this.toolsService.updateConfig(name, body.config);
  }
}
