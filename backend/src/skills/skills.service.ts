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

  private static readonly DEFAULTS: Array<{ name: string; description: string; content: string }> = [
    {
      name: 'brainstorming',
      description: 'You MUST use this before any creative work - exploring intent, requirements and design before implementation',
      content: `# Brainstorming Ideas Into Designs

Help turn ideas into fully formed designs and specs through natural collaborative dialogue.

<HARD-GATE>
Do NOT invoke any implementation skill, write any code, scaffold any project, or take any implementation action until you have presented a design and the user has approved it. This applies to EVERY project regardless of perceived simplicity.
</HARD-GATE>

## Anti-Pattern: "This Is Too Simple To Need A Design"

Every project goes through this process. A todo list, a single-function utility, a config change — all of them. "Simple" projects are where unexamined assumptions cause the most wasted work.

## Checklist

1. Explore project context — check files, docs, recent commits
2. Ask clarifying questions — one at a time, understand purpose/constraints/success criteria
3. Propose 2-3 approaches — with trade-offs and your recommendation
4. Present design — in sections scaled to their complexity, get user approval after each section
5. Write design doc — save to docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md
6. Spec self-review — quick inline check for placeholders, contradictions, ambiguity`,
    },
    {
      name: 'systematic-debugging',
      description: 'Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes',
      content: `# Systematic Debugging

## The Iron Law

NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST

## The Four Phases

### Phase 1: Root Cause Investigation
1. Read Error Messages Carefully — don't skip past errors
2. Reproduce Consistently — can you trigger it reliably?
3. Check Recent Changes — git diff, recent commits
4. Gather Evidence — trace data flow through components
5. Trace Data Flow — where does bad value originate?

### Phase 2: Pattern Analysis
1. Find Working Examples — similar code that works
2. Identify Differences — what's different between working and broken?
3. Understand Dependencies — what other components does this need?

### Phase 3: Hypothesis and Testing
1. Form Single Hypothesis — "I think X is the root cause because Y"
2. Test Minimally — smallest possible change to test hypothesis
3. Verify Before Continuing
4. When You Don't Know — say "I don't understand X", ask for help

### Phase 4: Implementation
1. Create failing test case first
2. Fix the root cause, not the symptom
3. Verify fix — test passes, no other tests broken
4. If fix doesn't work after 3 attempts: STOP and question the architecture`,
    },
    {
      name: 'dispatching-parallel-agents',
      description: 'Use when facing 2+ independent tasks that can be worked on without shared state or sequential dependencies',
      content: `# Dispatching Parallel Agents

## Overview

You delegate tasks to specialized agents with isolated context. By precisely crafting their instructions and context, you ensure they stay focused and succeed at their task.

**Core principle:** Dispatch one agent per independent problem domain. Let them work concurrently.

## When to Use

- 3+ test files failing with different root causes
- Multiple subsystems broken independently
- Each problem can be understood without context from others
- No shared state between investigations

Don't use when failures are related, need full system state, or agents would interfere.

## The Pattern

1. **Identify Independent Domains** — group failures by what's broken
2. **Create Focused Agent Tasks** — each agent gets specific scope, clear goal, constraints
3. **Dispatch in Parallel** — issue all subagent dispatches in the same response
4. **Review and Integrate** — read summaries, verify fixes don't conflict, run full suite`,
    },
    {
      name: 'executing-plans',
      description: 'Use when you have a written implementation plan to execute with review checkpoints',
      content: `# Executing Plans

## Overview

Load plan, review critically, execute all tasks, report when complete.

## The Process

### Step 1: Load and Review Plan
1. Read plan file
2. Review critically — identify any questions or concerns
3. If concerns: raise them before starting
4. If no concerns: create todos for plan items

### Step 2: Execute Tasks
For each task:
1. Mark as in_progress
2. Follow each step exactly
3. Run verifications as specified
4. Mark as completed

### Step 3: Complete Development
After all tasks complete and verified, finish the branch.

## When to Stop
- Hit a blocker (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- You don't understand an instruction
- Verification fails repeatedly`,
    },
  ];

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
    await this.seedDefaults();
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

  private async seedDefaults(): Promise<void> {
    const dir = await this.getDir();
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    if (files.length > 0) return;
    for (const skill of SkillsService.DEFAULTS) {
      const content = this.formatFile(skill.name, skill.description, skill.content);
      fs.writeFileSync(path.join(dir, `${skill.name}.md`), content, 'utf-8');
    }
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
