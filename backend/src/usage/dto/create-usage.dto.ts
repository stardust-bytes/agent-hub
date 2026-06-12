import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateUsageDto {
  @IsOptional()
  @IsInt()
  sessionId?: number;

  @IsString()
  modelName: string;

  @IsString()
  providerType: string;

  @IsInt()
  @Min(0)
  promptTokens: number;

  @IsInt()
  @Min(0)
  completionTokens: number;

  @IsInt()
  @Min(0)
  totalTokens: number;
}
