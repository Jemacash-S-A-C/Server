import { IsInt, IsNumber, IsPositive, IsString, IsUUID, Min } from 'class-validator';

export class MpConfirmDto {
  @IsUUID()
  application_id: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsInt()
  @Min(1)
  cuota_number: number;

  @IsString()
  mp_payment_id: string;
}
