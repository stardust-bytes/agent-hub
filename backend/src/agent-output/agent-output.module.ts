import { Module } from '@nestjs/common';
import { AgentOutputController } from './agent-output.controller';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [WorkspaceModule],
  controllers: [AgentOutputController],
})
export class AgentOutputModule {}
