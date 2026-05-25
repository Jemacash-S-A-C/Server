import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { EvaluationStatus } from '../entities/evaluation.entity';

export class UpdateEvaluationDto {
  @IsEnum(EvaluationStatus)
  status: EvaluationStatus;

  @IsNumber()
  @Min(0)
  @IsOptional()
  approved_amount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  risk_score?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
