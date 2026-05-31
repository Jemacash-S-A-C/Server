import 'dotenv/config'
import { DataSource } from 'typeorm'
import { User } from './users/entities/user.entity'
import { Session } from './users/entities/session.entity'
import { Guarantee } from './guarantees/entities/guarantee.entity'
import { LoanApplication } from './applications/entities/loan-application.entity'
import { Evaluation } from './evaluation/entities/evaluation.entity'
import { Signature } from './signature/entities/signature.entity'
import { Payment } from './payments/entities/payment.entity'
import { Document } from './documents/entities/document.entity'
import { PasswordResetToken } from './auth/entities/password-reset-token.entity'

/**
 * Standalone DataSource used by the TypeORM CLI (migration:generate, migration:run, etc.)
 * Reads DB credentials from the local .env file via dotenv/config.
 *
 * Usage:
 *   npm run migration:generate -- src/migrations/DescribeChange
 *   npm run migration:run
 *   npm run migration:revert
 *   npm run migration:show
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host:     process.env.DB_HOST     ?? 'localhost',
  port:     parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER     ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME     ?? 'jemacash',

  entities: [
    User,
    Session,
    Guarantee,
    LoanApplication,
    Evaluation,
    Signature,
    Payment,
    Document,
    PasswordResetToken,
  ],

  migrations: ['src/migrations/*.ts'],
  migrationsTableName: 'typeorm_migrations',
})
