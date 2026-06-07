import { IsString, IsOptional, IsInt, IsDateString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTaskDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['TODO', 'PROCESSING', 'DONE', 'FAILED'])
  status?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  priority?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
