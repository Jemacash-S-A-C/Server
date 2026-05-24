import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Evaluation, EvaluationStatus } from './entities/evaluation.entity';
import { UpdateEvaluationDto } from './dto/update-evaluation.dto';
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
  ): Promise<{ evaluation: Evaluation; newApplicationStatus: ApplicationStatus }> {
    const ev = await this.findByApplication(applicationId);

    if (ev.status !== EvaluationStatus.PENDING) {
      throw new BadRequestException('Evaluation already resolved');
    }

    Object.assign(ev, dto);
    const saved = await this.repo.save(ev);

    const newApplicationStatus =
      dto.status === EvaluationStatus.APPROVED
        ? ApplicationStatus.APPROVED
        : ApplicationStatus.REJECTED;

    return { evaluation: saved, newApplicationStatus };
  }
}
