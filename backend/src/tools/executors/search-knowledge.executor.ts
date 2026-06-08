import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { KnowledgeService } from '../../knowledge/knowledge.service';

const KB_NO_RESULTS = 'No relevant information found in knowledge base.';

@Injectable()
export class SearchKnowledgeExecutor implements ToolExecutor {
  readonly name = 'search_knowledge';

  constructor(private readonly knowledgeService: KnowledgeService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const chunks = await this.knowledgeService.search(args.query as string);
    if (chunks.length === 0) return KB_NO_RESULTS;
    return chunks.map((c, i) =>
      `[${i + 1}] Source: "${c.filename}", §${c.section || c.chunkIndex}\n${c.text}`
    ).join('\n\n---\n\n');
  }
}
