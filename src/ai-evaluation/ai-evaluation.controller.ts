import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AiEvaluationService } from './ai-evaluation.service';
import { ValuateDeviceDto } from './dto/valuate-device.dto';

@UseGuards(JwtAuthGuard)
@Controller('guarantees')
export class AiEvaluationController {
  constructor(private readonly aiEvaluationService: AiEvaluationService) {}

  @Post('ai-valuate')
  @HttpCode(200)
  valuate(@Body() dto: ValuateDeviceDto) {
    return this.aiEvaluationService.valuateDevice(dto);
  }

  @Get('ai-ping')
  ping() {
    return this.aiEvaluationService.ping();
  }
}
