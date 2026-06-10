import { Test } from '@nestjs/testing';
import { McpClientService } from './mcp-client.service';

describe('McpClientService', () => {
  let service: McpClientService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [McpClientService],
    }).compile();
    service = module.get(McpClientService);
  });

  it('returns false for isConnected when not connected', () => {
    expect(service.isConnected()).toBe(false);
  });

  it('returns error string when calling tool without connection', async () => {
    const result = await service.callTool('test', {});
    expect(result).toMatch(/Error/);
  });

  it('returns empty array for listTools without connection', async () => {
    const tools = await service.listTools();
    expect(tools).toEqual([]);
  });
});
