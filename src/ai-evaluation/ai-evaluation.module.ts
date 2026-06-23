import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiEvaluationController } from './ai-evaluation.controller';
import { AiEvaluationService } from './ai-evaluation.service';
import { DevicePrice } from './entities/device-price.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DevicePrice])],
  controllers: [AiEvaluationController],
  providers: [AiEvaluationService],
  exports: [AiEvaluationService],
})
export class AiEvaluationModule {}
