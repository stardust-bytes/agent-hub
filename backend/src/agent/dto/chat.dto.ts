import { IsString, IsOptional, IsInt } from 'class-validator';

export class ChatDto {
  @IsString()
  message: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsInt()
  sessionId: number;
}
