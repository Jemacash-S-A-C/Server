import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { GuaranteesService } from './guarantees.service';
import { CreateGuaranteeDto } from './dto/create-guarantee.dto';
import { UpdateGuaranteeAiDto } from './dto/update-guarantee-ai.dto';
import { ReportAuditDto } from './dto/report-audit.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@UseGuards(JwtAuthGuard)
@Controller('guarantees')
export class GuaranteesController {
  constructor(private readonly guaranteesService: GuaranteesService) {}

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.guaranteesService.findAll(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.guaranteesService.findOne(id, user.id);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateGuaranteeDto) {
    return this.guaranteesService.create(user.id, dto);
  }

  /** Creates a DRAFT guarantee (hidden from dashboard) to give the auditor a target ID. */
  @Post('draft')
  createDraft(@CurrentUser() user: User, @Body() dto: CreateGuaranteeDto) {
    return this.guaranteesService.createDraft(user.id, dto);
  }

  /** Confirms a DRAFT guarantee → promotes to ACTIVE and makes it visible in the dashboard. */
  @Patch(':id/confirm')
  confirm(@Param('id') id: string, @CurrentUser() user: User) {
    return this.guaranteesService.confirmGuarantee(id, user.id);
  }

  @Patch(':id/ai')
  updateAi(@Param('id') id: string, @CurrentUser() user: User, @Body() dto: UpdateGuaranteeAiDto) {
    return this.guaranteesService.updateAiFields(id, user.id, dto);
  }

  @Patch(':id/audit-report')
  reportAudit(@Param('id') id: string, @CurrentUser() user: User, @Body() dto: ReportAuditDto) {
    return this.guaranteesService.reportAudit(id, user.id, dto);
  }
}
