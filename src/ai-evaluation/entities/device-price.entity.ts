import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Lazy, per-model market-price cache. Populated on demand: the first valuation of
 * a given device fills it; later valuations of the same model reuse it (within TTL),
 * keeping prices consistent and saving Groq calls. Only the market reference price
 * is cached — photo/condition analysis still runs fresh per device.
 */
@Entity('device_prices')
export class DevicePrice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Normalized key: brand|model|year|ram|storage (lowercased, trimmed). */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 300 })
  cache_key: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  min_pen: number;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  max_pen: number;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  avg_pen: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
