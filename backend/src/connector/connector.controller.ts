import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ConnectorService } from './connector.service';
import { UpsertConnectorDto } from './dto/upsert-connector.dto';
import { UpdateConnectorDto } from './dto/update-connector.dto';

@Controller('connectors')
export class ConnectorController {
  constructor(private readonly connector: ConnectorService) {}

  @Get()
  async findAll() {
    return this.connector.findAll();
  }

  @Post()
  async upsert(@Body() body: UpsertConnectorDto) {
    return this.connector.upsert(body.type, body);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdateConnectorDto) {
    return this.connector.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.connector.remove(id);
    return { ok: true };
  }
}
