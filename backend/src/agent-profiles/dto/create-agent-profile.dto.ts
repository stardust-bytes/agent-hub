import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt } from 'class-validator';

export class CreateAgentProfileDto {
  @IsString() @IsNotEmpty() slug: string;
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() description?: string;
  @IsString() @IsNotEmpty() systemPrompt: string;
  @IsOptional() @IsString() allowedTools?: string;
  @IsOptional() @IsInt() modelId?: number;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
