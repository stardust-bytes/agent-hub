import { Injectable } from '@nestjs/common'
import { ToolExecutor } from './tool-executor.interface'
import { NotesService } from '../../notes/notes.service'

@Injectable()
export class ListNotesExecutor implements ToolExecutor {
  readonly name = 'list_notes'

  constructor(private readonly notesService: NotesService) {}

  async execute(_args: Record<string, unknown>): Promise<string> {
    try {
      const notes = await this.notesService.findAll()
      if (!notes.length) return 'No notes yet.'
      return notes.map((n, i) =>
        `${i + 1}. ${n.title}\n   ${n.content}`
      ).join('\n\n')
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown'}`
    }
  }
}
