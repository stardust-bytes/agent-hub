import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreateMemoryDto {
  @IsIn(['USER', 'FEEDBACK', 'PROJECT', 'REFERENCE'])
  type: 'USER' | 'FEEDBACK' | 'PROJECT' | 'REFERENCE';

  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  metadata?: string;
}
