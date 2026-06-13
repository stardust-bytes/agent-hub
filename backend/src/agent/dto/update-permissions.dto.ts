import { IsString, IsArray, IsOptional, IsIn } from 'class-validator';

export class UpdatePermissionsDto {
  @IsOptional()
  @IsString()
  @IsIn(['allow', 'deny'])
  defaultPolicy?: 'allow' | 'deny';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedTools?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deniedTools?: string[];

  @IsOptional()
  @IsString()
  permissionMode?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requireApprovalTools?: string[];
}
