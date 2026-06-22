import { IsString } from 'class-validator';

export class CreateSkillDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsString()
  content: string;
}
