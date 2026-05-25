import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max } from 'class-validator';
import { DocumentType } from '../entities/document.entity';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export class CreateDocumentDto {
  @IsEnum(DocumentType)
  document_type: DocumentType;

  @IsString()
  original_name: string;

  @IsInt()
  @Max(MAX_SIZE)
  file_size: number;

  @IsString()
  mime_type: string;

  @IsString()
  content_base64: string;

  @IsUUID()
  @IsOptional()
  application_id?: string;
}
