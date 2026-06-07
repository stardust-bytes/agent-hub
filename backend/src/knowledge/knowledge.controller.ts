import { Controller, Get, Post, Delete, Param, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KnowledgeService } from './knowledge.service';
import * as fs from 'fs';

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
    await this.knowledgeService.updateStatus(record.id, 'ready');
    return { id: record.id, filename: file.originalname, status: 'ready' };
  }

  @Delete(':id')
  async deleteFile(@Param('id') id: string) {
    await this.knowledgeService.remove(parseInt(id, 10));
    return { ok: true };
  }
}
