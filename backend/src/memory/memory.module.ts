import { Module } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { MemoryController } from './memory.controller';
import { MemoryGateway } from './memory.gateway';
import { MemoryExtractionService } from './memory-extraction.service';

@Module({
  controllers: [MemoryController],
  providers: [MemoryService, MemoryGateway, MemoryExtractionService],
  exports: [MemoryService, MemoryExtractionService],
})
export class MemoryModule {}
