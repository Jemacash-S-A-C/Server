import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  JoinColumn,
  CreateDateColumn,
  OneToOne,
} from 'typeorm';
import { LoanApplication } from '../../applications/entities/loan-application.entity';

@Entity('signatures')
export class Signature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  application_id: string;

  @OneToOne(() => LoanApplication, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application: LoanApplication;

  @Column({ type: 'text' })
  signature_base64: string;

  @Column({ type: 'json', nullable: true })
  document_urls: string[];

  @CreateDateColumn()
  created_at: Date;
}
