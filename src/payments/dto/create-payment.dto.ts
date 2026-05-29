import { IsEnum, IsNumber, IsPositive, IsUUID, IsInt, Min } from 'class-validator';
import { PaymentMethod } from '../entities/payment.entity';

const MANUAL_METHODS = [
  PaymentMethod.BCP,
  PaymentMethod.BBVA,
  PaymentMethod.YAPE,
  PaymentMethod.PLIN,
  PaymentMethod.EFECTIVO,
] as const;

type ManualPaymentMethod = (typeof MANUAL_METHODS)[number];

export class CreatePaymentDto {
  @IsUUID()
  application_id: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsEnum(MANUAL_METHODS)
  payment_method: ManualPaymentMethod;

  @IsInt()
  @Min(1)
  cuota_number: number;
}
