import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from '../../tools/executors/tool-executor.interface';
import { WordService } from '../word.service';
import { WorkspaceService } from '../../workspace/workspace.service';

@Injectable()
export class ReadWordExecutor implements ToolExecutor {
  readonly name = 'read_word';

  constructor(
    private readonly wordService: WordService,
    private readonly workspace: WorkspaceService,
  ) {}

  async execute(args: Record<string, unknown>, _context?: ToolContext): Promise<string> {
    const filePath = String(args.path ?? '');
    if (!filePath) return 'Error: "path" is required';

    if (!this.workspace.isPathAllowed(filePath)) {
      return `Error: path "${filePath}" is not allowed.`;
    }

    try {
      const result = await this.wordService.read(filePath);
      let output = result.content;
      if (result.tables.length > 0) {
        output += '\n\n--- Tables ---\n' + result.tables.join('\n\n');
      }
      output += `\n\n--- Metadata ---\nHeadings: ${result.metadata.headingCount}, Paragraphs: ${result.metadata.paragraphCount}`;
      return output;
    } catch (e) {
      return `Error reading file: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
