import {
  Controller, Post, Get, Param, UseInterceptors, UploadedFile,
  BadRequestException, NotFoundException, StreamableFile, Res, ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ChatUploadService } from './chat-upload.service';
import * as fs from 'fs';
import * as path from 'path';

@Controller('chat')
export class ChatUploadController {
  constructor(private readonly uploadService: ChatUploadService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    if (!file.mimetype.startsWith('image/')) throw new BadRequestException('Only image files accepted');
    if (file.size > 20 * 1024 * 1024) throw new BadRequestException('File too large (max 20MB)');

    const record = await this.uploadService.save(file);
    return {
      id: record.id,
      filename: file.originalname,
      url: `/api/chat/uploads/${record.id}/${encodeURIComponent(file.originalname)}`,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  @Get('uploads/:id/:filename')
  async serveFile(
    @Param('id', ParseIntPipe) id: number,
    @Param('filename') filename: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const record = await this.uploadService.findById(id);
    if (!record) throw new NotFoundException('File not found');

    const resolved = path.resolve(record.filepath);
    if (!fs.existsSync(resolved)) throw new NotFoundException('File not found on disk');

    const mime = record.mimeType || 'application/octet-stream';
    res.set({ 'Content-Type': mime });
    return new StreamableFile(fs.createReadStream(resolved));
  }
}
