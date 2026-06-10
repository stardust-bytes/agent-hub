import { IsString } from 'class-validator';

export class SetProjectDto {
  @IsString()
  path: string;
}
