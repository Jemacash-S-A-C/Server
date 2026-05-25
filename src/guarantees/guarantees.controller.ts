import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { GuaranteesService } from './guarantees.service';
import { CreateGuaranteeDto } from './dto/create-guarantee.dto';
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
}
