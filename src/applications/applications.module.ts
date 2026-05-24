import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { LoanApplication } from './entities/loan-application.entity';
import { EvaluationModule } from '../evaluation/evaluation.module';
import { SignatureModule } from '../signature/signature.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LoanApplication]),
    forwardRef(() => EvaluationModule),
    SignatureModule,
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
