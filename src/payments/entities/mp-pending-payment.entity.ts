import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('mp_pending_payments')
export class MpPendingPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @Column()
  application_id: string;

  @Column()
  cuota_number: number;

  @Column()
  preference_id: string;

  @CreateDateColumn()
  created_at: Date;
}
