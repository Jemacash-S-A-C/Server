import {
  IsString, IsOptional, IsArray, IsBoolean, MaxLength,
} from 'class-validator';

export class ValuateDeviceDto {
  @IsString()
  @MaxLength(50)
  device_category: string;

  @IsString()
  @MaxLength(100)
  brand: string;

  @IsString()
  @MaxLength(200)
  model: string;

  @IsString()
  @MaxLength(4)
  manufacture_year: string;

  @IsString()
  @MaxLength(200)
  processor: string;

  @IsString()
  @MaxLength(50)
  ram: string;

  @IsString()
  @MaxLength(50)
  storage: string;

  @IsString()
  @IsOptional()
  @MaxLength(5)
  battery_health?: string;

  @IsString()
  @MaxLength(20)
  condition: string;

  @IsBoolean()
  is_reconditioned: boolean;

  @IsArray()
  @IsString({ each: true })
  photos: string[];
}
