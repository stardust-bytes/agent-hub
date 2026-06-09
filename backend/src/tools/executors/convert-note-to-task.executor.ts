import { Injectable } from '@nestjs/common'
import { ToolExecutor } from './tool-executor.interface'
import { NotesService } from '../../notes/notes.service'
import { TasksService } from '../../tasks/tasks.service'

@Injectable()
export class ConvertNoteToTaskExecutor implements ToolExecutor {
  readonly name = 'convert_note_to_task'

  constructor(
    private readonly notesService: NotesService,
    private readonly tasksService: TasksService,
  ) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const noteId = Number(args.noteId)
    if (!noteId) return 'Error: noteId is required.'

    try {
      const note = await this.notesService.findOne(noteId)
      const task = await this.tasksService.create({
        title: note.title,
        description: note.content,
      })
      await this.notesService.remove(noteId)
      return `Converted note "${note.title}" to task #${task.id}`
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown'}`
    }
  }
}
