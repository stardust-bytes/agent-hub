import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { OllamaProvider } from './providers/ollama.provider';
import { TasksModule } from '../tasks/tasks.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [TasksModule, KnowledgeModule],
  controllers: [AgentController],
  providers: [AgentService, OllamaProvider],
})
export class AgentModule {}
