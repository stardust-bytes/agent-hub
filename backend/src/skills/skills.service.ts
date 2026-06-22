import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { SettingsService } from '../settings/settings.service';
import { CreateSkillDto } from './dto/create-skill.dto';

export interface SkillMeta {
  name: string;
  description: string;
  content: string;
}

@Injectable()
export class SkillsService {
  constructor(private readonly settings: SettingsService) {}

  private async getDir(): Promise<string> {
    const base = (await this.settings.get('skills.path', './workspace_data/skills')).replace(/\\/g, '/');
    if (path.isAbsolute(base)) return base;
    return path.resolve(process.cwd(), base);
  }

  private async filePath(name: string): Promise<string> {
    return path.join(await this.getDir(), `${name.replace(/[^a-z0-9-]/gi, '')}.md`);
  }

  private async ensureDir(): Promise<void> {
    const dir = await this.getDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  async findAll(): Promise<SkillMeta[]> {
    await this.ensureDir();
    const dir = await this.getDir();
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    return files.map(f => this.readFile(path.join(dir, f))).filter(Boolean) as SkillMeta[];
  }

  async findByName(name: string): Promise<SkillMeta | null> {
    await this.ensureDir();
    const fp = await this.filePath(name);
    if (!fs.existsSync(fp)) return null;
    return this.readFile(fp);
  }

  async create(dto: CreateSkillDto): Promise<SkillMeta> {
    await this.ensureDir();
    const content = this.formatFile(dto.name, dto.description, dto.content);
    const fp = await this.filePath(dto.name);
    fs.writeFileSync(fp, content, 'utf-8');
    return { name: dto.name, description: dto.description, content: dto.content };
  }

  async update(name: string, dto: CreateSkillDto): Promise<SkillMeta> {
    await this.ensureDir();
    const content = this.formatFile(dto.name, dto.description, dto.content);
    const oldPath = await this.filePath(name);
    const newPath = await this.filePath(dto.name);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    if (oldPath !== newPath && fs.existsSync(newPath)) fs.unlinkSync(newPath);
    fs.writeFileSync(newPath, content, 'utf-8');
    return { name: dto.name, description: dto.description, content: dto.content };
  }

  async remove(name: string): Promise<void> {
    const fp = await this.filePath(name);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }

  private readFile(fp: string): SkillMeta | null {
    try {
      const raw = fs.readFileSync(fp, 'utf-8');
      const name = path.basename(fp).replace(/\.md$/, '');
      const descMatch = raw.match(/^---[\s\S]*?description:\s*"([^"]*)"[\s\S]*?^---\s*\n?/m);
      const desc = descMatch ? descMatch[1] : '';
      const bodyMatch = raw.match(/^---[\s\S]*?^---\s*\n?([\s\S]*)$/m);
      const content = bodyMatch ? bodyMatch[1].trim() : raw;
      return { name, description: desc, content };
    } catch {
      return null;
    }
  }

  private formatFile(name: string, description: string, content: string): string {
    return `---\nname: ${name}\ndescription: "${description}"\n---\n\n${content}\n`;
  }
}
