import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { MpChargeDto } from './dto/mp-charge.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Post('mp-charge')
  mpCharge(@Request() req, @Body() dto: MpChargeDto) {
    return this.service.mpCharge(req.user.id, dto);
  }

  @Post()
  create(@Request() req, @Body() dto: CreatePaymentDto) {
    return this.service.create(req.user.id, dto);
  }

  @Get()
  findAll(@Request() req) {
    return this.service.findAll(req.user.id);
  }

  @Get('application/:appId')
  findByApplication(@Request() req, @Param('appId') appId: string) {
    return this.service.findByApplication(appId, req.user.id);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.service.findOne(id, req.user.id);
  }
}
