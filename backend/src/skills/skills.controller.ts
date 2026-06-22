import { Controller, Get, Post, Patch, Delete, Body, Param, NotFoundException } from '@nestjs/common';
import { SkillsService } from './skills.service';
import { CreateSkillDto } from './dto/create-skill.dto';

@Controller('skills')
export class SkillsController {
  constructor(private readonly skills: SkillsService) {}

  @Get()
  async findAll() {
    return this.skills.findAll();
  }

  @Get(':name')
  async findOne(@Param('name') name: string) {
    const skill = await this.skills.findByName(name);
    if (!skill) throw new NotFoundException(`Skill "${name}" not found`);
    return skill;
  }

  @Post()
  async create(@Body() body: CreateSkillDto) {
    return this.skills.create(body);
  }

  @Patch(':name')
  async update(@Param('name') name: string, @Body() body: CreateSkillDto) {
    return this.skills.update(name, body);
  }

  @Delete(':name')
  async remove(@Param('name') name: string) {
    await this.skills.remove(name);
    return { ok: true };
  }
}
