import { Body, Controller, Get, Inject, Param, Post, UseGuards, forwardRef } from '@nestjs/common';
import { SignatureService } from './signature.service';
import { CreateSignatureDto } from './dto/create-signature.dto';
import { ApplicationsService } from '../applications/applications.service';
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
    // Verify ownership before proceeding
    await this.applicationsService.findOne(applicationId, user.id);
    // Service handles both signature creation and status transition (signed or auto-approved)
    return this.signatureService.create(applicationId, user.id, dto);
  }

  @Get()
  findOne(
    @Param('applicationId') applicationId: string,
  ) {
    return this.signatureService.findByApplication(applicationId);
  }
}
