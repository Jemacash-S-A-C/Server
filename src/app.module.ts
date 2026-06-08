import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { TwoFactorModule } from './auth/two-factor/two-factor.module';
import { UsersModule } from './users/users.module';
import { ApplicationsModule } from './applications/applications.module';
import { GuaranteesModule } from './guarantees/guarantees.module';
import { EvaluationModule } from './evaluation/evaluation.module';
import { SignatureModule } from './signature/signature.module';
import { PaymentsModule } from './payments/payments.module';
import { DocumentsModule } from './documents/documents.module';
import { AiEvaluationModule } from './ai-evaluation/ai-evaluation.module';
import { DefaultsModule } from './defaults/defaults.module';
import { MonthlySummaryModule } from './monthly-summary/monthly-summary.module';
import { Document } from './documents/entities/document.entity';
import { User } from './users/entities/user.entity';
import { Session } from './users/entities/session.entity';
import { Guarantee } from './guarantees/entities/guarantee.entity';
import { LoanApplication } from './applications/entities/loan-application.entity';
import { Evaluation } from './evaluation/entities/evaluation.entity';
import { Signature } from './signature/entities/signature.entity';
import { Payment } from './payments/entities/payment.entity';
import { MpPendingPayment } from './payments/entities/mp-pending-payment.entity';
import { PasswordResetToken } from './auth/entities/password-reset-token.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'jemacash',
      entities: [User, Session, Guarantee, LoanApplication, Evaluation, Signature, Payment, MpPendingPayment, Document, PasswordResetToken],
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
      migrationsTableName: 'typeorm_migrations',
      synchronize: process.env.NODE_ENV !== 'production',
      migrationsRun: process.env.NODE_ENV === 'production',
      logging: process.env.NODE_ENV === 'development',
    }),
    ScheduleModule.forRoot(),
    MailModule,
    AuthModule,
    TwoFactorModule,
    UsersModule,
    ApplicationsModule,
    GuaranteesModule,
    EvaluationModule,
    SignatureModule,
    PaymentsModule,
    DocumentsModule,
    AiEvaluationModule,
    DefaultsModule,
    MonthlySummaryModule,
  ],
})
export class AppModule {}
