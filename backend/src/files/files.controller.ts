import { Controller, Get, Param, ParseIntPipe, NotFoundException, StreamableFile, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Controller('files')
export class FilesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('agent/:id/download')
  async downloadAgentFile(@Param('id', ParseIntPipe) id: number, @Res({ passthrough: true }) res: Response) {
    const agentFile = await this.prisma.agentFile.findUnique({ where: { id } });
    if (!agentFile) throw new NotFoundException('File not found');

    const resolved = path.resolve(agentFile.path);
    if (!fs.existsSync(resolved)) throw new NotFoundException('File not found on disk');

    const stat = fs.statSync(resolved);
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${agentFile.filename}"`,
      'Content-Length': stat.size,
    });

    return new StreamableFile(fs.createReadStream(resolved));
  }
}
