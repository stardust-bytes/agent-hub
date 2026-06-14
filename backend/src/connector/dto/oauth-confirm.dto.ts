import { IsString } from 'class-validator';

export class OAuthConfirmDto {
  @IsString()
  state: string;

  @IsString()
  code: string;
}
