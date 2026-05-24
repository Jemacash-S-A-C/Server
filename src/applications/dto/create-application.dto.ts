import { IsNumber, IsInt, IsOptional, IsUUID, Min, Max } from 'class-validator';

export class CreateApplicationDto {
  @IsNumber()
  @Min(1000)
  @Max(50000)
  amount: number;

  @IsInt()
  @Min(1)
  @Max(60)
  term_months: number;

  @IsUUID()
  @IsOptional()
  guarantee_id?: string;
}
