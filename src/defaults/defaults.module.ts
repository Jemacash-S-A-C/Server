import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoanApplication } from '../applications/entities/loan-application.entity';
import { Payment } from '../payments/entities/payment.entity';
import { DefaultsService } from './defaults.service';

@Module({
  imports: [TypeOrmModule.forFeature([LoanApplication, Payment])],
  providers: [DefaultsService],
  exports: [DefaultsService],
})
export class DefaultsModule {}
