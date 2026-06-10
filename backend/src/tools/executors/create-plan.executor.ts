import { Injectable } from '@nestjs/common';
import { ToolExecutor, ToolContext } from './tool-executor.interface';
import { PlansService } from '../../plans/plans.service';

@Injectable()
export class CreatePlanExecutor implements ToolExecutor {
  readonly name = 'create_plan';

  constructor(private readonly plansService: PlansService) {}

  async execute(args: Record<string, unknown>, context?: ToolContext): Promise<string> {
    const title = String(args.title ?? '');
    const steps = args.steps as string[] | undefined;
    const requireApproval = args.requireApproval !== false;

    if (!title || !steps || !Array.isArray(steps) || steps.length === 0) {
      return 'Error: title (string) and steps (string[]) are required.';
    }
    if (steps.length > 10) {
      return 'Error: Maximum 10 steps allowed.';
    }
    if (!context?.sessionId) {
      return 'Error: sessionId is required.';
    }

    const plan = await this.plansService.create(context.sessionId, title, steps);

    if (!requireApproval) {
      await this.plansService.approve(plan.id);
    }

    return `[PLAN_CREATED] id=${plan.id} requireApproval=${requireApproval} title="${title}"`;
  }
}
