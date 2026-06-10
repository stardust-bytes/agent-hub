import { Controller, Get, Post, Delete, Body } from '@nestjs/common';
import { WorkspaceWatcherService } from './workspace-watcher.service';
import { WatchDto } from './dto/watch.dto';

@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly watcher: WorkspaceWatcherService) {}

  @Post('watch')
  async watch(@Body() dto: WatchDto) {
    const directory = dto.directory;
    await this.watcher.startWatch(directory);
    return { ok: true, directory: directory || this.watcher.getStatus().directory };
  }

  @Get('watch/status')
  getStatus() {
    return this.watcher.getStatus();
  }

  @Delete('watch')
  async stopWatch() {
    await this.watcher.stopWatch();
    return { ok: true };
  }
}
