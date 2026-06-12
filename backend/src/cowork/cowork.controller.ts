import { Controller, Get, Post, Delete, Body, Query, Param, BadRequestException } from '@nestjs/common';
import { CoworkService, SavedProject } from './cowork.service';
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

  @Get('projects')
  async getProjectsList(): Promise<SavedProject[]> {
    return this.cowork.getProjectsList();
  }

  @Post('projects')
  async saveProject(@Body() body: { name: string; path: string }): Promise<SavedProject> {
    if (!body.name || !body.path) throw new BadRequestException('name and path are required');
    return this.cowork.saveProject(body.name, body.path);
  }

  @Delete('projects/:id')
  async deleteProject(@Param('id') id: string) {
    await this.cowork.deleteProject(id);
    return { ok: true };
  }

  @Get('drives')
  async getDrives() {
    return this.cowork.getDrives();
  }

  @Get('browse')
  async browse(@Query('path') path: string) {
    if (!path) throw new BadRequestException('path query parameter is required');
    return this.cowork.browseDirectory(path);
  }

  @Get('read-file')
  async readFile(@Query('path') filePath: string) {
    if (!filePath) throw new BadRequestException('path query parameter is required');
    const status = await this.cowork.getStatus();
    if (!status.projectPath) throw new BadRequestException('No project connected');
    return this.cowork.readFile(filePath, status.projectPath);
  }
}
