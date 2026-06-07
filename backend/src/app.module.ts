import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { TasksModule } from './tasks/tasks.module';
import { AgentModule } from './agent/agent.module';
import { OllamaModule } from './ollama/ollama.module';
import { SettingsModule } from './settings/settings.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { SessionsModule } from './sessions/sessions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    TasksModule,
    AgentModule,
    OllamaModule,
    SettingsModule,
    KnowledgeModule,
    SessionsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
