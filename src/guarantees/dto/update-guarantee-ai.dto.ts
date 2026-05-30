import { IsArray, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateGuaranteeAiDto {
  @IsNumber() @Min(0) @IsOptional() ai_market_value?: number;
  @IsNumber() @Min(0) @IsOptional() ai_resale_value?: number;
  @IsNumber() @Min(0) @IsOptional() ai_max_loan?: number;
  @IsNumber() @Min(0) @IsOptional() ai_condition_score?: number;
  @IsArray() @IsString({ each: true }) @IsOptional() ai_depreciation_factors?: string[];
  @IsNumber() @Min(0) @IsOptional() ai_confidence?: number;
  @IsString() @IsOptional() ai_reasoning?: string;
  @IsString() @MaxLength(20) @IsOptional() ai_visual_condition?: string;
}
