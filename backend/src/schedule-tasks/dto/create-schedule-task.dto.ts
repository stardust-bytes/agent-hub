import { IsString, IsOptional, IsInt, IsIn, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateScheduleTaskDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  prompt: string;

  @IsOptional()
  @IsIn(['manual', 'hourly', 'daily', 'weekdays', 'weekly'])
  frequency?: string;

  @IsOptional()
  @IsInt()
  @Min(0) @Max(59)
  @Type(() => Number)
  cronMinute?: number;

  @IsOptional()
  @IsInt()
  @Min(0) @Max(23)
  @Type(() => Number)
  cronHour?: number;

  @IsOptional()
  @IsInt()
  @Min(0) @Max(6)
  @Type(() => Number)
  cronDayOfWeek?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  modelId?: number;

  @IsOptional()
  @IsString()
  projectPath?: string;
}
