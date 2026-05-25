import {
  IsString, IsNumber, IsOptional, IsArray,
  MaxLength, Min, IsObject,
} from 'class-validator';

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

  // ── Technology-specific (all optional) ───────────────────────────────────

  @IsString()
  @MaxLength(50)
  @IsOptional()
  device_category?: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  brand?: string;

  @IsString()
  @MaxLength(200)
  @IsOptional()
  model?: string;

  @IsString()
  @MaxLength(4)
  @IsOptional()
  manufacture_year?: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  serial_number?: string;

  @IsString()
  @MaxLength(20)
  @IsOptional()
  condition?: string;

  @IsObject()
  @IsOptional()
  specs?: Record<string, string>;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  photo_urls?: string[];
}
