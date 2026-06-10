import { IsString, IsOptional, IsInt, IsIn } from 'class-validator';

export class ChatDto {
  @IsString()
  message: string;

  @IsInt()
  providerModelId: number;

  @IsInt()
  sessionId: number;

  @IsString()
  @IsOptional()
  @IsIn(['agent', 'chat', 'cowork'])
  mode?: string;
}
