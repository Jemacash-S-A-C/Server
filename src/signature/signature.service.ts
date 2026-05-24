import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Signature } from './entities/signature.entity';
import { CreateSignatureDto } from './dto/create-signature.dto';
import { ApplicationStatus } from '../applications/entities/loan-application.entity';

@Injectable()
export class SignatureService {
  constructor(
    @InjectRepository(Signature) private readonly repo: Repository<Signature>,
  ) {}

  async create(
    applicationId: string,
    dto: CreateSignatureDto,
  ): Promise<Signature> {
    const existing = await this.repo.findOne({ where: { application_id: applicationId } });
    if (existing) throw new ConflictException('Signature already exists for this application');

    const sig = this.repo.create({ application_id: applicationId, ...dto });
    return this.repo.save(sig);
  }

  async findByApplication(applicationId: string): Promise<Signature> {
    const sig = await this.repo.findOne({ where: { application_id: applicationId } });
    if (!sig) throw new NotFoundException('Signature not found');
    return sig;
  }
}
