import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportAuditDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  serial_number: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  manufacture_year?: string;

  @IsObject()
  specs: Record<string, string>;
}

