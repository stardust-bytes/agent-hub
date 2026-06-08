import { IsString, IsNotEmpty } from 'class-validator';

export class CreateProviderModelDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
