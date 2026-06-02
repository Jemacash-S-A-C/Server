import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Guarantee, GuaranteeStatus } from './entities/guarantee.entity';
import { CreateGuaranteeDto } from './dto/create-guarantee.dto';
import { UpdateGuaranteeAiDto } from './dto/update-guarantee-ai.dto';
import { ReportAuditDto } from './dto/report-audit.dto';

@Injectable()
export class GuaranteesService {
  constructor(
    @InjectRepository(Guarantee) private readonly repo: Repository<Guarantee>,
  ) {}

  findAll(userId: string): Promise<Guarantee[]> {
    return this.repo.find({ where: { user_id: userId }, order: { created_at: 'DESC' } });
  }

  async create(userId: string, dto: CreateGuaranteeDto): Promise<Guarantee> {
    const guarantee = this.repo.create({ ...dto, estimated_value: dto.estimated_value ?? 0, user_id: userId });
    return this.repo.save(guarantee);
  }

  async findOne(id: string, userId: string): Promise<Guarantee> {
    const g = await this.repo.findOne({ where: { id, user_id: userId } });
    if (!g) throw new NotFoundException('Guarantee not found');
    return g;
  }

  async updateAiFields(id: string, userId: string, dto: UpdateGuaranteeAiDto): Promise<Guarantee> {
    const g = await this.findOne(id, userId);
    Object.assign(g, dto);
    // Keep estimated_value in sync so every component that reads it shows a real number
    if (dto.ai_resale_value !== undefined && dto.ai_resale_value > 0) {
      g.estimated_value = dto.ai_resale_value;
    }
    // Once the AI valuation completes, promote from pending_evaluation → active (available)
    if (g.status === GuaranteeStatus.PENDING_EVALUATION) {
      g.status = GuaranteeStatus.ACTIVE;
    }
    return this.repo.save(g);
  }

  async reportAudit(id: string, userId: string, dto: ReportAuditDto): Promise<Guarantee> {
    const g = await this.findOne(id, userId);
    const prevSpecs = g.specs ?? {};
    const mergedSpecs: Record<string, string> = {
      ...prevSpecs,
      ...dto.specs,
      audit_verified: 'true',
      audit_source: 'local_agent',
      audit_completed_at: new Date().toISOString(),
    };

    g.serial_number = dto.serial_number;
    if (dto.brand) g.brand = dto.brand;
    if (dto.model) g.model = dto.model;
    if (dto.manufacture_year) g.manufacture_year = dto.manufacture_year;
    g.specs = mergedSpecs;

    return this.repo.save(g);
  }
}
