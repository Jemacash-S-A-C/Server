import { IsEmail, IsInt, IsNumber, IsOptional, IsPositive, IsString, IsNotEmpty, IsUUID, Min } from 'class-validator';

export class MpChargeDto {
  @IsUUID()
  application_id: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsInt()
  @Min(1)
  cuota_number: number;

  @IsString()
  @IsNotEmpty()
  token: string;

  @IsInt()
  @Min(1)
  installments: number;

  @IsString()
  @IsNotEmpty()
  payment_method_id: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  issuer_id?: string;
}
