import { IsString, IsOptional, IsInt, IsIn } from 'class-validator';

export class ChatDto {
  @IsString()
  message: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsInt()
  sessionId: number;

  @IsString()
  @IsOptional()
  @IsIn(['agent', 'chat'])
  mode?: string;
}
