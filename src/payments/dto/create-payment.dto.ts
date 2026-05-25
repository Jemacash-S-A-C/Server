import { IsEnum, IsNumber, IsPositive, IsString, IsUUID, IsInt, Min } from 'class-validator';
import { PaymentMethod } from '../entities/payment.entity';

export class CreatePaymentDto {
  @IsUUID()
  application_id: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod;

  @IsInt()
  @Min(1)
  cuota_number: number;
}
