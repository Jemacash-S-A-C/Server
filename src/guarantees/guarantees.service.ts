import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
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
    // DRAFT guarantees are invisible to the user until explicitly confirmed
    return this.repo.find({
      where: { user_id: userId, status: Not(GuaranteeStatus.DRAFT) },
      order: { created_at: 'DESC' },
    });
  }

  async create(userId: string, dto: CreateGuaranteeDto): Promise<Guarantee> {
    const guarantee = this.repo.create({ ...dto, estimated_value: dto.estimated_value ?? 0, user_id: userId });
    return this.repo.save(guarantee);
  }

  /** Creates a DRAFT guarantee — invisible in the dashboard.
   *  The auditor tool uses its ID to post the hardware report.
   *  Call confirmGuarantee() after the audit passes to make it visible. */
  async createDraft(userId: string, dto: CreateGuaranteeDto): Promise<Guarantee> {
    const guarantee = this.repo.create({
      ...dto,
      estimated_value: dto.estimated_value ?? 0,
      user_id: userId,
      status: GuaranteeStatus.DRAFT,
    });
    return this.repo.save(guarantee);
  }

  /** Promotes a DRAFT guarantee to ACTIVE so it appears in the user's dashboard.
   *  Throws BadRequestException if the AI resale value is below the S/ 350 minimum. */
  async confirmGuarantee(id: string, userId: string): Promise<Guarantee> {
    const g = await this.findOne(id, userId);
    if (g.ai_resale_value !== null && g.ai_resale_value !== undefined) {
      if (Number(g.ai_resale_value) < 350) {
        throw new BadRequestException(
          `El valor de reventa estimado (S/ ${Number(g.ai_resale_value).toFixed(2)}) es menor al mínimo requerido de S/ 350.`,
        );
      }
    }
    g.status = GuaranteeStatus.ACTIVE;
    return this.repo.save(g);
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

    const { major, notes } = this.checkDiscrepancies(g, dto);

    const mergedSpecs: Record<string, string> = {
      ...prevSpecs,
      ...dto.specs,
      audit_verified: major ? 'discrepancy' : 'true',
      audit_source: 'local_agent',
      audit_completed_at: new Date().toISOString(),
      ...(major ? { audit_discrepancy: 'major', audit_discrepancy_notes: notes ?? '' } : {}),
    };

    if (!major) {
      g.serial_number = dto.serial_number;
      if (dto.brand) g.brand = dto.brand;
      if (dto.model) g.model = dto.model;
      if (dto.manufacture_year) g.manufacture_year = dto.manufacture_year;
    }
    g.specs = mergedSpecs;

    return this.repo.save(g);
  }

  private checkDiscrepancies(
    g: Guarantee,
    dto: ReportAuditDto,
  ): { major: boolean; notes?: string } {
    const issues: string[] = [];

    // Brand check (normalize and compare)
    if (dto.brand && g.brand) {
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const declared = normalize(g.brand);
      const audited  = normalize(dto.brand);
      if (declared.length > 2 && audited.length > 2) {
        if (!declared.includes(audited) && !audited.includes(declared)) {
          issues.push(`Marca declarada: "${g.brand}" vs auditada: "${dto.brand}"`);
        }
      }
    }

    // RAM check (allow 25% tolerance for OS overhead)
    const declaredRam = parseInt((g.specs?.ram ?? '').replace(/[^0-9]/g, '') || '0', 10);
    const auditRam    = parseInt(dto.specs?.total_ram_gb ?? dto.specs?.ram ?? '0', 10);
    if (declaredRam > 0 && auditRam > 0) {
      if (Math.abs(declaredRam - auditRam) / declaredRam > 0.25) {
        issues.push(`RAM declarada: ${g.specs?.ram} vs auditada: ${auditRam} GB`);
      }
    }

    // Storage check (allow 20% tolerance for drive capacity reporting differences)
    const declaredStorage = parseInt((g.specs?.storage ?? '').replace(/[^0-9]/g, '') || '0', 10);
    const auditStorage    = parseInt(dto.specs?.primary_disk_size_gb ?? dto.specs?.storage ?? '0', 10);
    if (declaredStorage > 0 && auditStorage > 0) {
      if (Math.abs(declaredStorage - auditStorage) / declaredStorage > 0.20) {
        issues.push(`Almacenamiento declarado: ${g.specs?.storage} vs auditado: ${auditStorage} GB`);
      }
    }

    return {
      major: issues.length > 0,
      notes: issues.length > 0 ? issues.join(' | ') : undefined,
    };
  }
}
