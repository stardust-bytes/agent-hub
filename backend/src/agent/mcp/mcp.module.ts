import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';
import { McpClientService } from './mcp-client.service';

@Module({
  providers: [McpService, McpClientService],
  exports: [McpService, McpClientService],
})
export class McpModule {}
