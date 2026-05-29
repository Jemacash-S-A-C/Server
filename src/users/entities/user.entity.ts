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

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => Session, (s) => s.user)
  sessions: Session[];
}
