import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsBoolean()
  notification_email?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['pen', 'usd', 'eur'])
  pref_currency?: string;

  @IsOptional()
  @IsString()
  @IsIn(['es', 'en'])
  pref_language?: string;

  @IsOptional()
  @IsString()
  @IsIn(['lima', 'madrid', 'miami'])
  pref_timezone?: string;
}
