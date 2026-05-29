import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Session } from './session.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  full_name: string;

  @Column({ unique: true, length: 254 })
  email: string;

  @Column({ nullable: true })
  password_hash: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ length: 100, nullable: true, unique: true })
  google_id: string;

  // ── 2FA ──────────────────────────────────────────────────────────────────────

  @Column({ type: 'varchar', length: 64, nullable: true, default: null })
  totp_secret: string | null;

  @Column({ type: 'boolean', default: false })
  totp_enabled: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true, default: null })
  sms_2fa_phone: string | null;

  @Column({ type: 'boolean', default: false })
  sms_2fa_enabled: boolean;

  @Column({ type: 'varchar', length: 64, nullable: true, default: null })
  sms_otp_hash: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  sms_otp_expires_at: Date | null;

  // ── Preferences ────────────────────────────────────────────────────────────

  @Column({ type: 'boolean', default: true })
  notification_email: boolean;

  @Column({ type: 'varchar', length: 10, default: 'pen' })
  pref_currency: string;

  @Column({ type: 'varchar', length: 10, default: 'es' })
  pref_language: string;

  @Column({ type: 'varchar', length: 50, default: 'lima' })
  pref_timezone: string;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => Session, (s) => s.user)
  sessions: Session[];
}
