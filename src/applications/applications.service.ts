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

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(LoanApplication)
    private readonly repo: Repository<LoanApplication>,
    @Inject(forwardRef(() => EvaluationService))
    private readonly evaluationService: EvaluationService,
  ) {}

  findAll(userId: string): Promise<LoanApplication[]> {
    return this.repo.find({
      where: { user_id: userId },
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

    await this.evaluationService.initiate(saved.id);

    return saved;
  }

  async updateStatus(id: string, status: ApplicationStatus): Promise<LoanApplication> {
    const app = await this.repo.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    app.status = status;
    return this.repo.save(app);
  }
}
