import { Controller, Get, Post, Delete, Body } from '@nestjs/common';
import { CoworkService } from './cowork.service';
import { SetProjectDto } from './dto/set-project.dto';

@Controller('cowork')
export class CoworkController {
  constructor(private readonly cowork: CoworkService) {}

  @Post('project')
  async setProject(@Body() dto: SetProjectDto) {
    await this.cowork.setProject(dto.path);
    return { ok: true };
  }

  @Get('project')
  async getProject() {
    return this.cowork.getStatus();
  }

  @Delete('project')
  async clearProject() {
    await this.cowork.clearProject();
    return { ok: true };
  }
}
