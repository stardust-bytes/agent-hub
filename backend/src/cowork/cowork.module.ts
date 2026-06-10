import { Module } from '@nestjs/common';
import { CoworkService } from './cowork.service';
import { CoworkController } from './cowork.controller';
import { SettingsModule } from '../settings/settings.module';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [SettingsModule, WorkspaceModule],
  controllers: [CoworkController],
  providers: [CoworkService],
  exports: [CoworkService],
})
export class CoworkModule {}
