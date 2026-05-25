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

  @Column({ type: 'text', nullable: true, default: null })
  description: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  estimated_value: number;

  @Column({ type: 'enum', enum: GuaranteeStatus, default: GuaranteeStatus.ACTIVE })
  status: GuaranteeStatus;

  // ── Technology-specific fields (nullable → backward-compatible) ───────────

  /** Device category: laptop | smartphone | tablet | desktop | consola | smartwatch */
  @Column({ type: 'varchar', length: 50, nullable: true })
  device_category: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  brand: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  model: string | null;

  @Column({ type: 'varchar', length: 4, nullable: true })
  manufacture_year: string | null;

  /** Unique hardware identifier (serial number or IMEI) */
  @Column({ type: 'varchar', length: 100, nullable: true })
  serial_number: string | null;

  /** Physical condition: excelente | bueno | regular */
  @Column({ type: 'varchar', length: 20, nullable: true })
  condition: string | null;

  /** Technical specifications stored as JSON: processor, ram, storage, battery_health, screen_size */
  @Column({ type: 'jsonb', nullable: true })
  specs: Record<string, string> | null;

  /** Array of photo identifiers / mock URLs uploaded by the user */
  @Column({ type: 'jsonb', nullable: true })
  photo_urls: string[] | null;

  @CreateDateColumn()
  created_at: Date;
}
