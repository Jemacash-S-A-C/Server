import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';

export class CreateSignatureDto {
  @IsString()
  @IsNotEmpty()
  signature_base64: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  document_urls?: string[];
}
