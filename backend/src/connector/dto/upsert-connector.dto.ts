import { IsString, IsOptional, IsBoolean, IsArray, IsObject } from 'class-validator';

export class UpsertConnectorDto {
  @IsString()
  type: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  services?: string[];

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
