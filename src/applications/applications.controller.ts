import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@UseGuards(JwtAuthGuard)
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.applicationsService.findAll(user.id);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateApplicationDto) {
    return this.applicationsService.create(user.id, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.applicationsService.findOne(id, user.id);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @CurrentUser() user: User) {
    return this.applicationsService.submit(id, user.id);
  }

  // Provisional bypass — remove when real admin approval flow is implemented
  @Patch(':id/approve-bypass')
  approveBypass(@Param('id') id: string, @CurrentUser() user: User) {
    return this.applicationsService.approveBypass(id, user.id);
  }
}
