import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateApplicationDto {
  @IsNumber()
  @Min(100)
  @IsOptional()
  amount?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  term_months?: number;

  @IsString()
  @IsOptional()
  guarantee_id?: string;
}
