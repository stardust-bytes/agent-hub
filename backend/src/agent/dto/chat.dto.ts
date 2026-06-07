import { IsString, IsOptional } from 'class-validator';

export class ChatDto {
  @IsString()
  message: string;

  @IsString()
  @IsOptional()
  model?: string;
}
