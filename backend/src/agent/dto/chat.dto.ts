import { IsString, IsOptional, IsInt, IsIn, IsArray } from 'class-validator';

export class ChatDto {
  @IsString()
  message: string;

  @IsInt()
  providerModelId: number;

  @IsInt()
  sessionId: number;

  @IsString()
  @IsOptional()
  @IsIn(['cowork'])
  mode?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  fileIds?: number[];
}
