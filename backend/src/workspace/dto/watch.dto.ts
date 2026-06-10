import { IsOptional, IsString } from 'class-validator';

export class WatchDto {
  @IsOptional()
  @IsString()
  directory?: string;
}
