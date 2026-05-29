import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../users/entities/user.entity';
import { TwoFactorService } from './two-factor.service';
import { TwoFactorController } from './two-factor.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [TwoFactorController],
  providers: [TwoFactorService],
})
export class TwoFactorModule {}
