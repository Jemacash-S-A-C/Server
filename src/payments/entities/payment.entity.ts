import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { LoanApplication } from '../../applications/entities/loan-application.entity';

export enum PaymentStatus {
  COMPLETED = 'completed',
  FAILED    = 'failed',
}

export enum PaymentMethod {
  BCP          = 'bcp',
  BBVA         = 'bbva',
  YAPE         = 'yape',
  PLIN         = 'plin',
  EFECTIVO     = 'efectivo',
  MERCADOPAGO  = 'mercadopago',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  application_id: string;

  @ManyToOne(() => LoanApplication, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application: LoanApplication;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: PaymentMethod })
  payment_method: PaymentMethod;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.COMPLETED })
  status: PaymentStatus;

  @Column({ type: 'int' })
  cuota_number: number;

  @Column({ type: 'varchar', length: 32, unique: true })
  reference_number: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  mp_payment_id: string | null;

  @CreateDateColumn()
  created_at: Date;
}
