import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Evaluation, EvaluationStatus } from './entities/evaluation.entity';
import { UpdateEvaluationDto } from './entities/update-evaluation.dto';
import { ApplicationStatus } from '../applications/entities/loan-application.entity';

@Injectable()
export class EvaluationService {
  constructor(
    @InjectRepository(Evaluation) private readonly repo: Repository<Evaluation>,
  ) {}

  async initiate(applicationId: string): Promise<Evaluation> {
    const existing = await this.repo.findOne({ where: { application_id: applicationId } });
    if (existing) return existing;
    const evaluation = this.repo.create({ application_id: applicationId });
    return this.repo.save(evaluation);
  }

  async findByApplication(applicationId: string): Promise<Evaluation> {
    const ev = await this.repo.findOne({ where: { application_id: applicationId } });
    if (!ev) throw new NotFoundException('Evaluation not found');
    return ev;
  }

  async update(
    applicationId: string,
    dto: UpdateEvaluationDto,
  ): Promise<{ evaluation: Evaluation; newApplicationStatus: ApplicationStatus | null }> {
    const ev = await this.findByApplication(applicationId);

    // Only block status changes on already-resolved evaluations.
    // Metadata-only updates (approved_amount, risk_score, notes) are always allowed.
    if (dto.status !== undefined && ev.status !== EvaluationStatus.PENDING) {
      throw new BadRequestException('Evaluation already resolved');
    }

    Object.assign(ev, dto);
    const saved = await this.repo.save(ev);

    // Only change application status when evaluation is explicitly approved/rejected.
    // A null return means "no application status change needed".
    const newApplicationStatus =
      dto.status === EvaluationStatus.APPROVED
        ? ApplicationStatus.APPROVED
        : dto.status === EvaluationStatus.REJECTED
        ? ApplicationStatus.REJECTED
        : null;

    return { evaluation: saved, newApplicationStatus };
  }
}
