import { IsString, IsNumber, IsOptional, MaxLength, Min } from 'class-validator';

export class CreateGuaranteeDto {
  @IsString()
  @MaxLength(100)
  type: string;

  @IsString()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  estimated_value: number;
}
