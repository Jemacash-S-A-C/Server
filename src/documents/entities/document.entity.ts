import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum DocumentType {
  DNI            = 'dni',
  PASSPORT       = 'passport',
  PAY_STUB       = 'pay_stub',
  UTILITY_BILL   = 'utility_bill',
  SOAT           = 'soat',
  VEHICLE_CARD   = 'vehicle_card',
  OTHER          = 'other',
}

export enum DocumentStatus {
  PENDING    = 'pending',
  REVIEWING  = 'reviewing',
  VERIFIED   = 'verified',
  REJECTED   = 'rejected',
}

@Entity('loan_documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @Column({ nullable: true })
  application_id: string;

  @Column({ type: 'enum', enum: DocumentType })
  document_type: DocumentType;

  @Column({ type: 'varchar' })
  original_name: string;

  @Column({ type: 'int' })
  file_size: number;

  @Column({ type: 'varchar' })
  mime_type: string;

  @Column({ type: 'text' })
  content_base64: string;

  @Column({ type: 'enum', enum: DocumentStatus, default: DocumentStatus.PENDING })
  status: DocumentStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  created_at: Date;
}
