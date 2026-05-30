import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Guarantee } from '../../guarantees/entities/guarantee.entity';

export enum ApplicationStatus {
  DRAFT      = 'draft',
  SUBMITTED  = 'submitted',
  SIGNED     = 'signed',
  APPROVED   = 'approved',
  DISBURSED  = 'disbursed',
  REJECTED   = 'rejected',
}

@Entity('loan_applications')
export class LoanApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: true })
  guarantee_id: string;

  @ManyToOne(() => Guarantee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'guarantee_id' })
  guarantee: Guarantee;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'int' })
  term_months: number;

  @Column({ type: 'enum', enum: ApplicationStatus, default: ApplicationStatus.DRAFT })
  status: ApplicationStatus;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
