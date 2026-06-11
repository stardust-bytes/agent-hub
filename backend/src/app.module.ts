import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { TasksModule } from './tasks/tasks.module';
import { NotesModule } from './notes/notes.module';
import { AgentModule } from './agent/agent.module';
import { SettingsModule } from './settings/settings.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { SessionsModule } from './sessions/sessions.module';
import { ProvidersModule } from './providers/providers.module';
import { ToolsModule } from './tools/tools.module';
import { PlansModule } from './plans/plans.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { CoworkModule } from './cowork/cowork.module';
import { FilesModule } from './files/files.module';
import { ModePolicyModule } from './mode-policy/mode-policy.module';
import { MemoryModule } from './memory/memory.module';
import { ExcelModule } from './excel/excel.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    TasksModule,
    NotesModule,
    AgentModule,
    SettingsModule,
    KnowledgeModule,
    SessionsModule,
    ProvidersModule,
    ToolsModule,
    PlansModule,
    WorkspaceModule,
    CoworkModule,
    FilesModule,
    ModePolicyModule,
    MemoryModule,
    ExcelModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
