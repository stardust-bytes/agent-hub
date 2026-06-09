import { Injectable } from '@nestjs/common'
import { ToolExecutor } from './tool-executor.interface'
import { NotesService } from '../../notes/notes.service'

@Injectable()
export class CreateNoteExecutor implements ToolExecutor {
  readonly name = 'create_note'

  constructor(private readonly notesService: NotesService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const title = args.title as string
    const content = args.content as string
    if (!title || !content) return 'Error: title and content are required.'

    try {
      const note = await this.notesService.create({ title, content })
      return `Created note #${note.id}: "${note.title}"`
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown'}`
    }
  }
}
