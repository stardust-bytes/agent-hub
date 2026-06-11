import { IsOptional, IsBoolean, IsArray, IsString } from 'class-validator';

export class UpdateYoloConfigDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  disabledPatterns?: string[];

  @IsOptional()
  @IsBoolean()
  failClosed?: boolean;

  @IsOptional()
  @IsBoolean()
  safeToolAllowlist?: boolean;
}
