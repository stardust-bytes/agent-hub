import { Controller, Get, Delete, Param } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';

@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  async getAll() {
    return this.knowledgeService.findAll();
  }

  @Delete(':id')
  async deleteFile(@Param('id') id: string) {
    await this.knowledgeService.remove(parseInt(id, 10));
    return { ok: true };
  }
}
