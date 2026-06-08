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
import { LoanApplication, ApplicationStatus } from '../applications/entities/loan-application.entity';
import { Guarantee, GuaranteeStatus } from '../guarantees/entities/guarantee.entity';
import { ApplicationsService } from '../applications/applications.service';

@Injectable()
export class SignatureService {
  constructor(
    @InjectRepository(Signature)
    private readonly repo: Repository<Signature>,

    @InjectRepository(LoanApplication)
    private readonly appRepo: Repository<LoanApplication>,

    @InjectRepository(Guarantee)
    private readonly guaranteeRepo: Repository<Guarantee>,

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

    // Pledge the guarantee now that the user has committed by signing
    const app = await this.appRepo.findOne({ where: { id: applicationId } });
    if (app?.guarantee_id) {
      await this.guaranteeRepo.update(
        { id: app.guarantee_id },
        { status: GuaranteeStatus.PLEDGED },
      );
    }

    // Signing always results in immediate approval.
    // The AI audit + hardware check already validated the device before the user
    // reached the signing step, so no manual review is needed.
    await this.applicationsService.updateStatus(applicationId, ApplicationStatus.APPROVED);

    return saved;
  }

  async findByApplication(applicationId: string): Promise<Signature> {
    const sig = await this.repo.findOne({ where: { application_id: applicationId } });
    if (!sig) throw new NotFoundException('Signature not found');
    return sig;
  }
}
