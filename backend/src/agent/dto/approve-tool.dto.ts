import { IsString, IsBoolean } from 'class-validator';

export class ApproveToolDto {
  @IsString()
  id: string;

  @IsBoolean()
  approved: boolean;
}
