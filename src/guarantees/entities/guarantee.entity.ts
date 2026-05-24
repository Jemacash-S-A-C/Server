import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum GuaranteeStatus {
  ACTIVE = 'active',
  PLEDGED = 'pledged',
  RELEASED = 'released',
}

@Entity('guarantees')
export class Guarantee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 100 })
  type: string;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  estimated_value: number;

  @Column({ type: 'enum', enum: GuaranteeStatus, default: GuaranteeStatus.ACTIVE })
  status: GuaranteeStatus;

  @CreateDateColumn()
  created_at: Date;
}
