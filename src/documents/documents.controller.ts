import {
  Controller, Get, Post, Delete, Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateDocumentDto) {
    return this.service.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.service.findAllByUser(user.id);
  }

  @Get('application/:applicationId')
  findByApplication(
    @CurrentUser() user: User,
    @Param('applicationId') applicationId: string,
  ) {
    return this.service.findByApplication(user.id, applicationId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.findOne(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.remove(user.id, id);
  }
}
