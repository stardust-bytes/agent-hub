import { Module } from '@nestjs/common'
import { NotesController } from './notes.controller'
import { NotesService } from './notes.service'
import { NotesGateway } from './notes.gateway'

@Module({
  controllers: [NotesController],
  providers: [NotesService, NotesGateway],
  exports: [NotesService],
})
export class NotesModule {}
