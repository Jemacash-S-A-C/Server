import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SignatureController } from './signature.controller';
import { SignatureService } from './signature.service';
import { Signature } from './entities/signature.entity';
import { Guarantee } from '../guarantees/entities/guarantee.entity';
import { Document } from '../documents/entities/document.entity';
import { LoanApplication } from '../applications/entities/loan-application.entity';
import { ApplicationsModule } from '../applications/applications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Signature, Guarantee, Document, LoanApplication]),
    forwardRef(() => ApplicationsModule),
  ],
  controllers: [SignatureController],
  providers: [SignatureService],
  exports: [SignatureService],
})
export class SignatureModule {}
