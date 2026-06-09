import { Injectable } from '@nestjs/common'
import { ToolExecutor } from './tool-executor.interface'
import { NotesService } from '../../notes/notes.service'

@Injectable()
export class DeleteNoteExecutor implements ToolExecutor {
  readonly name = 'delete_note'

  constructor(private readonly notesService: NotesService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const id = Number(args.id)
    if (!id) return 'Error: id is required.'

    try {
      await this.notesService.remove(id)
      return `Deleted note #${id}`
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown'}`
    }
  }
}
