import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Signature } from './entities/signature.entity';
import { CreateSignatureDto } from './dto/create-signature.dto';
import { ApplicationStatus } from '../applications/entities/loan-application.entity';
import { ApplicationsService } from '../applications/applications.service';

@Injectable()
export class SignatureService {
  constructor(
    @InjectRepository(Signature) private readonly repo: Repository<Signature>,
    @Inject(forwardRef(() => ApplicationsService))
    private readonly applicationsService: ApplicationsService,
  ) {}

  async create(
    applicationId: string,
    dto: CreateSignatureDto,
  ): Promise<Signature> {
    const existing = await this.repo.findOne({ where: { application_id: applicationId } });
    if (existing) throw new ConflictException('Signature already exists for this application');

    const sig = this.repo.create({ application_id: applicationId, ...dto });
    const saved = await this.repo.save(sig);

    await this.applicationsService.updateStatus(applicationId, ApplicationStatus.SIGNED);

    return saved;
  }

  async findByApplication(applicationId: string): Promise<Signature> {
    const sig = await this.repo.findOne({ where: { application_id: applicationId } });
    if (!sig) throw new NotFoundException('Signature not found');
    return sig;
  }
}
