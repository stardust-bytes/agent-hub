import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { NotesService } from '../../notes/notes.service';
import { ScheduleTasksService } from '../../schedule-tasks/schedule-tasks.service';
import { ProvidersService } from '../../providers/providers.service';

@Injectable()
export class ConvertNoteToTaskExecutor implements ToolExecutor {
  readonly name = 'convert_note_to_task';

  constructor(
    private readonly notesService: NotesService,
    private readonly scheduleTasksService: ScheduleTasksService,
    private readonly providersService: ProvidersService,
  ) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const noteId = Number(args.noteId);
    if (!noteId) return 'Error: noteId is required.';

    try {
      const note = await this.notesService.findOne(noteId);

      let modelId = args.modelId as number | undefined;
      if (!modelId) {
        const models = await this.providersService.findAllModels();
        if (models.length > 0) modelId = models[0].id;
      }

      const task = await this.scheduleTasksService.create({
        name: note.title,
        description: note.content.substring(0, 200) || null,
        prompt: note.content,
        frequency: 'manual',
        modelId: modelId ?? null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      await this.notesService.remove(noteId);
      return `Converted note "${note.title}" to schedule task #${task.id}`;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown'}`;
    }
  }
}
