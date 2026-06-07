import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { LoanApplication } from '../applications/entities/loan-application.entity';
import { Payment } from '../payments/entities/payment.entity';
import { MailModule } from '../mail/mail.module';
import { MonthlySummaryService } from './monthly-summary.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, LoanApplication, Payment]),
    MailModule,
  ],
  providers: [MonthlySummaryService],
  exports: [MonthlySummaryService],
})
export class MonthlySummaryModule {}
