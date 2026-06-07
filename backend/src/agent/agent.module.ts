import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { OllamaProvider } from './providers/ollama.provider';
import { LLMCallerService } from './services/llm-caller.service';
import { ContextBuilderService } from './services/context-builder.service';
import { TasksModule } from '../tasks/tasks.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [TasksModule, KnowledgeModule, SessionsModule],
  controllers: [AgentController],
  providers: [
    AgentService,
    OllamaProvider,
    LLMCallerService,
    ContextBuilderService,
  ],
})
export class AgentModule {}
