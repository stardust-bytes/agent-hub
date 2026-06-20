import { Module } from '@nestjs/common';
import { AgentProfilesService } from './agent-profiles.service';
import { AgentProfilesController } from './agent-profiles.controller';

@Module({
  controllers: [AgentProfilesController],
  providers: [AgentProfilesService],
  exports: [AgentProfilesService],
})
export class AgentProfilesModule {}
