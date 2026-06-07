import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { OllamaProvider } from './providers/ollama.provider';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [KnowledgeModule],
  controllers: [AgentController],
  providers: [AgentService, OllamaProvider],
})
export class AgentModule {}
