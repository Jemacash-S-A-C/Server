import { Body, Controller, Get, Inject, Param, Patch, UseGuards, forwardRef } from '@nestjs/common';
import { EvaluationService } from './evaluation.service';
import { UpdateEvaluationDto } from './entities/update-evaluation.dto';
import { ApplicationsService } from '../applications/applications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('applications/:applicationId/evaluation')
export class EvaluationController {
  constructor(
    private readonly evaluationService: EvaluationService,
    @Inject(forwardRef(() => ApplicationsService))
    private readonly applicationsService: ApplicationsService,
  ) {}

  @Get()
  findOne(@Param('applicationId') applicationId: string) {
    return this.evaluationService.findByApplication(applicationId);
  }

  @Patch()
  async update(
    @Param('applicationId') applicationId: string,
    @Body() dto: UpdateEvaluationDto,
  ) {
    const { evaluation, newApplicationStatus } = await this.evaluationService.update(
      applicationId,
      dto,
    );
    if (newApplicationStatus !== null) {
      await this.applicationsService.updateStatus(applicationId, newApplicationStatus);
    }
    return evaluation;
  }
}
