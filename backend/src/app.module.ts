import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { TasksModule } from './tasks/tasks.module';
import { AgentModule } from './agent/agent.module';
import { SettingsModule } from './settings/settings.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { SessionsModule } from './sessions/sessions.module';
import { ProvidersModule } from './providers/providers.module';
import { ToolsModule } from './tools/tools.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    TasksModule,
    AgentModule,
    SettingsModule,
    KnowledgeModule,
    SessionsModule,
    ProvidersModule,
    ToolsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
