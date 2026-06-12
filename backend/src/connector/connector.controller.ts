import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ConnectorService } from './connector.service';

@Controller('connectors')
export class ConnectorController {
  constructor(private readonly connector: ConnectorService) {}

  @Get()
  async findAll() {
    return this.connector.findAll();
  }

  @Post()
  async upsert(@Body() body: { type: string; name: string; config: Record<string, unknown>; enabled?: boolean }) {
    return this.connector.upsert(body.type, body);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: { name?: string; config?: Record<string, unknown>; enabled?: boolean }) {
    return this.connector.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.connector.remove(id);
    return { ok: true };
  }
}
