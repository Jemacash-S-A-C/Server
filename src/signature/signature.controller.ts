import { Body, Controller, Get, Inject, Param, Post, UseGuards, forwardRef } from '@nestjs/common';
import { SignatureService } from './signature.service';
import { CreateSignatureDto } from './dto/create-signature.dto';
import { ApplicationsService } from '../applications/applications.service';
import { ApplicationStatus } from '../applications/entities/loan-application.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@UseGuards(JwtAuthGuard)
@Controller('applications/:applicationId/signature')
export class SignatureController {
  constructor(
    private readonly signatureService: SignatureService,
    @Inject(forwardRef(() => ApplicationsService))
    private readonly applicationsService: ApplicationsService,
  ) {}

  @Post()
  async create(
    @Param('applicationId') applicationId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateSignatureDto,
  ) {
    await this.applicationsService.findOne(applicationId, user.id);
    const sig = await this.signatureService.create(applicationId, dto);
    await this.applicationsService.updateStatus(applicationId, ApplicationStatus.SIGNED);
    return sig;
  }

  @Get()
  findOne(
    @Param('applicationId') applicationId: string,
    @CurrentUser() user: User,
  ) {
    return this.signatureService.findByApplication(applicationId);
  }
}
