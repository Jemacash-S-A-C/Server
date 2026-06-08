import { IsInt, IsUUID, Min } from 'class-validator';

export class MpCheckDto {
  @IsUUID()
  application_id: string;

  @IsInt()
  @Min(1)
  cuota_number: number;
}
