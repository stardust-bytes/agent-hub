import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { PlansService } from '../../plans/plans.service';

@Injectable()
export class ResumePlanExecutor implements ToolExecutor {
  readonly name = 'resume_plan';

  constructor(private readonly plansService: PlansService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const planId = Number(args.planId);
    if (!planId) return 'Error: planId is required (number)';

    try {
      const plan = await this.plansService.findOne(planId);
      const doneSteps = plan.steps.filter(s => s.status === 'DONE').length;
      const totalSteps = plan.steps.length;
      const pendingSteps = totalSteps - doneSteps;

      const lines: string[] = [
        `Plan #${plan.id}: "${plan.title}"`,
        `Status: ${plan.status}`,
        `Steps: ${doneSteps}/${totalSteps} completed`,
      ];

      if (plan.status === 'PENDING') {
        lines.push('Action required: User must approve this plan before execution.');
      } else if (plan.status === 'APPROVED') {
        lines.push('Approved — ready to execute.');
      } else if (pendingSteps > 0) {
        lines.push(`${pendingSteps} step(s) remaining. Ready to resume.`);
      } else {
        lines.push('All steps completed.');
      }

      return lines.join('\n');
    } catch {
      return `Error: Plan #${planId} not found.`;
    }
  }
}
