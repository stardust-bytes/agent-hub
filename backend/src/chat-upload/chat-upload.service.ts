import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ChatUploadService implements OnModuleInit {
  private readonly logger = new Logger(ChatUploadService.name);
  private uploadDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const workspaceDir = path.resolve(this.config.get('UPLOAD_DIR', './workspace_data/uploads'));
    this.uploadDir = path.join(workspaceDir, 'chat-uploads');
    fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  async save(file: Express.Multer.File) {
    const record = await this.prisma.chatUpload.create({
      data: {
        filename: file.originalname,
        filepath: '',
        size: file.size,
        mimeType: file.mimetype,
      },
    });

    const ext = path.extname(file.originalname) || '';
    const filename = `${record.id}${ext}`;
    const filepath = path.join(this.uploadDir, filename);
    fs.writeFileSync(filepath, file.buffer);

    await this.prisma.chatUpload.update({
      where: { id: record.id },
      data: { filepath },
    });

    return { ...record, filepath };
  }

  async findById(id: number) {
    return this.prisma.chatUpload.findUnique({ where: { id } });
  }

  async findByIds(ids: number[]) {
    return this.prisma.chatUpload.findMany({ where: { id: { in: ids } } });
  }

  loadImageBase64(filepath: string, mimeType: string): string {
    const data = fs.readFileSync(filepath);
    return `data:${mimeType};base64,${data.toString('base64')}`;
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOrphaned() {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000);
    try {
      const oldFiles = await this.prisma.chatUpload.findMany({
        where: { createdAt: { lt: cutoff } },
      });
      for (const f of oldFiles) {
        try {
          if (fs.existsSync(f.filepath)) fs.unlinkSync(f.filepath);
        } catch { /* ignore per-file cleanup errors */ }
      }
      await this.prisma.chatUpload.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      if (oldFiles.length > 0) {
        this.logger.log(`Cleaned up ${oldFiles.length} orphaned chat upload(s)`);
      }
    } catch { /* ignore cleanup errors */ }
  }
}
