import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';
import { McpClientService } from './mcp-client.service';
import { WorkspaceModule } from '../../workspace/workspace.module';

@Module({
  imports: [WorkspaceModule],
  providers: [McpService, McpClientService],
  exports: [McpService, McpClientService],
})
export class McpModule {}
