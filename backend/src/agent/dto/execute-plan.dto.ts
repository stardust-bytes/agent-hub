import { IsInt } from 'class-validator';

export class ExecutePlanDto {
  @IsInt()
  providerModelId: number;

  @IsInt()
  sessionId: number;
}
