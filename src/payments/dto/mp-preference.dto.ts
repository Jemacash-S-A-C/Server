import { IsEmail, IsInt, IsNumber, IsPositive, IsUUID, Min } from 'class-validator';

export class MpPreferenceDto {
  @IsUUID()
  application_id: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsInt()
  @Min(1)
  cuota_number: number;

  @IsEmail()
  email: string;
}
