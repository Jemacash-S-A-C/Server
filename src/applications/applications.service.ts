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

  async submit(id: string, userId: string): Promise<LoanApplication> {
    const app = await this.findOne(id, userId);

    if (app.status !== ApplicationStatus.DRAFT) {
      throw new BadRequestException('Only draft applications can be submitted');
    }

    app.status = ApplicationStatus.SUBMITTED;
    const saved = await this.repo.save(app);

    // Pledge the linked guarantee so it cannot be reused
    if (saved.guarantee_id) {
      await this.guaranteeRepo.update(
        { id: saved.guarantee_id, user_id: userId },
        { status: GuaranteeStatus.PLEDGED },
      );
    }

    await this.evaluationService.initiate(saved.id);

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
