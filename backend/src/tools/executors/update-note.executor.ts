import { Injectable } from '@nestjs/common'
import { ToolExecutor } from './tool-executor.interface'
import { NotesService } from '../../notes/notes.service'

@Injectable()
export class UpdateNoteExecutor implements ToolExecutor {
  readonly name = 'update_note'

  constructor(private readonly notesService: NotesService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const id = Number(args.id)
    if (!id) return 'Error: id is required.'

    try {
      const dto: Record<string, string> = {}
      if (args.title) dto.title = args.title as string
      if (args.content) dto.content = args.content as string
      const note = await this.notesService.update(id, dto)
      return `Updated note #${note.id}: "${note.title}"`
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown'}`
    }
  }
}
