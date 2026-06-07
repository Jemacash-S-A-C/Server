import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  LoanApplication,
  ApplicationStatus,
} from './entities/loan-application.entity';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { EvaluationService } from '../evaluation/evaluation.service';
import { Guarantee, GuaranteeStatus } from '../guarantees/entities/guarantee.entity';

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(LoanApplication)
    private readonly repo: Repository<LoanApplication>,
    @InjectRepository(Guarantee)
    private readonly guaranteeRepo: Repository<Guarantee>,
    @Inject(forwardRef(() => EvaluationService))
    private readonly evaluationService: EvaluationService,
  ) {}

  findAll(userId: string): Promise<LoanApplication[]> {
    return this.repo.find({
      where: { user_id: userId },
      relations: { guarantee: true },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<LoanApplication> {
    const app = await this.repo.findOne({ where: { id, user_id: userId } });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  async create(userId: string, dto: CreateApplicationDto): Promise<LoanApplication> {
    const app = this.repo.create({ ...dto, user_id: userId, status: ApplicationStatus.DRAFT });
    return this.repo.save(app);
  }

  async update(id: string, userId: string, dto: UpdateApplicationDto): Promise<LoanApplication> {
    const app = await this.findOne(id, userId);
    if (app.status !== ApplicationStatus.DRAFT) {
      throw new BadRequestException('Only draft applications can be updated');
    }
    if (dto.amount      !== undefined) app.amount      = dto.amount;
    if (dto.term_months !== undefined) app.term_months = dto.term_months;
    if (dto.guarantee_id !== undefined) app.guarantee_id = dto.guarantee_id;
    return this.repo.save(app);
  }

  async submit(id: string, userId: string): Promise<LoanApplication> {
    const app = await this.findOne(id, userId);

    if (app.status !== ApplicationStatus.DRAFT) {
      throw new BadRequestException('Only draft applications can be submitted');
    }

    app.status = ApplicationStatus.SUBMITTED;
    const saved = await this.repo.save(app);

    // NOTE: the guarantee is pledged only when the user actually signs the contract,
    // not here — so an abandoned application does not lock the guarantee.

    await this.evaluationService.initiate(saved.id);

    return saved;
  }

  /**
   * User-initiated cancellation before signing.
   * Sets status to CANCELLED and frees the guarantee (in case it was ever pledged).
   */
  async cancel(id: string, userId: string): Promise<LoanApplication> {
    const app = await this.findOne(id, userId);

    if (!['draft', 'submitted'].includes(app.status)) {
      throw new BadRequestException('Only draft or submitted applications can be cancelled');
    }

    app.status = ApplicationStatus.CANCELLED;
    const saved = await this.repo.save(app);

    // Free the guarantee regardless — defensive in case it was pledged
    if (saved.guarantee_id) {
      await this.guaranteeRepo.update(
        { id: saved.guarantee_id, user_id: userId },
        { status: GuaranteeStatus.ACTIVE },
      );
    }

    return saved;
  }

  async updateStatus(id: string, status: ApplicationStatus): Promise<LoanApplication> {
    const app = await this.repo.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    app.status = status;
    return this.repo.save(app);
  }

  // Provisional bypass — remove when real admin approval flow is implemented
  async approveBypass(id: string, userId: string): Promise<LoanApplication> {
    await this.findOne(id, userId);
    return this.updateStatus(id, ApplicationStatus.APPROVED);
  }

  /**
   * Triggered by the field agent after physical device collection and verification.
   * Transitions approved → disbursed, stamps disbursed_at, keeps guarantee as pledged.
   * Provisional: will be restricted to agent/admin role once that flow is built.
   */
  async disburse(id: string, userId: string): Promise<LoanApplication> {
    const app = await this.findOne(id, userId);
    if (app.status !== ApplicationStatus.APPROVED) {
      throw new BadRequestException('Only approved applications can be disbursed');
    }
    app.status      = ApplicationStatus.DISBURSED;
    app.disbursed_at = new Date();
    return this.repo.save(app);
  }

  /**
   * Declares a loan in default: sets status to DEFAULTED and guarantee to SEIZED.
   * Called by the DefaultsService cron job — no userId check (internal use).
   */
  async declareDefault(id: string): Promise<LoanApplication> {
    const app = await this.repo.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    if (app.status !== ApplicationStatus.DISBURSED) {
      throw new BadRequestException('Only disbursed applications can be declared in default');
    }
    app.status = ApplicationStatus.DEFAULTED;
    const saved = await this.repo.save(app);

    if (saved.guarantee_id) {
      await this.guaranteeRepo.update(
        { id: saved.guarantee_id },
        { status: GuaranteeStatus.SEIZED },
      );
    }

    return saved;
  }
}
