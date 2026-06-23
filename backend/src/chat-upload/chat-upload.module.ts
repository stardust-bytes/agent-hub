import { Module } from '@nestjs/common';
import { ChatUploadController } from './chat-upload.controller';
import { ChatUploadService } from './chat-upload.service';

@Module({
  controllers: [ChatUploadController],
  providers: [ChatUploadService],
  exports: [ChatUploadService],
})
export class ChatUploadModule {}
