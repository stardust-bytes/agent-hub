import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class UpsertConnectorDto {
  @IsString()
  type: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
