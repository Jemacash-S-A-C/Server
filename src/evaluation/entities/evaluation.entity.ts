import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';
import { LoanApplication } from '../../applications/entities/loan-application.entity';

export enum EvaluationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('evaluations')
export class Evaluation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  application_id: string;

  @OneToOne(() => LoanApplication, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application: LoanApplication;

  @Column({ type: 'enum', enum: EvaluationStatus, default: EvaluationStatus.PENDING })
  status: EvaluationStatus;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  approved_amount: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  risk_score: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
