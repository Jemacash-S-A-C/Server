import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuaranteesController } from './guarantees.controller';
import { GuaranteesService } from './guarantees.service';
import { Guarantee } from './entities/guarantee.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Guarantee])],
  controllers: [GuaranteesController],
  providers: [GuaranteesService],
  exports: [GuaranteesService],
})
export class GuaranteesModule {}
