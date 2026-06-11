import { IsOptional, IsString, IsIn } from 'class-validator';

export class SearchMemoryDto {
  @IsOptional()
  @IsIn(['USER', 'FEEDBACK', 'PROJECT', 'REFERENCE'])
  type?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}
