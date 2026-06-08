import { Controller, Get, Post, Delete, Param, Body, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsString } from 'class-validator';
import { KnowledgeService } from './knowledge.service';
import * as fs from 'fs';

class SearchDto {
  @IsString()
  query: string;
}

@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  async getAll() {
    return this.knowledgeService.findAll();
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const record = await this.knowledgeService.create(file.originalname, file.size, file.mimetype);
    fs.writeFileSync(record.filepath, file.buffer);
    this.knowledgeService.processFile(record.id).catch(() => {});
    return { id: record.id, filename: file.originalname, status: 'indexing' };
  }

  @Post('search')
  async search(@Body() dto: SearchDto) {
    return this.knowledgeService.search(dto.query);
  }

  @Post('reindex')
  async reindexAll() {
    await this.knowledgeService.reindexAll();
    return { ok: true };
  }

  @Delete(':id')
  async deleteFile(@Param('id') id: string) {
    await this.knowledgeService.remove(parseInt(id, 10));
    return { ok: true };
  }
}
