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
import { Document, DocumentType } from '../documents/entities/document.entity';
import { ApplicationsService } from '../applications/applications.service';

/** Minimum AI confidence (0–1) required for automatic approval */
const AUTO_APPROVE_CONFIDENCE_THRESHOLD = 0.85;

/** Document types the user must have uploaded to qualify for auto-approval */
const REQUIRED_DOC_TYPES: DocumentType[] = [DocumentType.DNI, DocumentType.PAY_STUB];

@Injectable()
export class SignatureService {
  constructor(
    @InjectRepository(Signature)
    private readonly repo: Repository<Signature>,

    @InjectRepository(LoanApplication)
    private readonly appRepo: Repository<LoanApplication>,

    @InjectRepository(Guarantee)
    private readonly guaranteeRepo: Repository<Guarantee>,

    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,

    @Inject(forwardRef(() => ApplicationsService))
    private readonly applicationsService: ApplicationsService,
  ) {}

  async create(
    applicationId: string,
    userId: string,
    dto: CreateSignatureDto,
  ): Promise<Signature> {
    const existing = await this.repo.findOne({ where: { application_id: applicationId } });
    if (existing) throw new ConflictException('Signature already exists for this application');

    const sig = this.repo.create({ application_id: applicationId, ...dto });
    const saved = await this.repo.save(sig);

    // Pledge the guarantee now that the user has actually committed by signing
    const app = await this.appRepo.findOne({ where: { id: applicationId } });
    if (app?.guarantee_id) {
      await this.guaranteeRepo.update(
        { id: app.guarantee_id },
        { status: GuaranteeStatus.PLEDGED },
      );
    }

    // Evaluate whether conditions allow immediate approval or need manual review
    const newStatus = await this.evaluateAutoApprove(applicationId, userId);
    await this.applicationsService.updateStatus(applicationId, newStatus);

    return saved;
  }

  /**
   * Returns APPROVED if:
   *  1. User has uploaded all required document types (DNI + pay stub)
   *  2. The linked guarantee has an AI confidence score ≥ threshold
   *
   * Returns SIGNED (manual review) in any other case, including errors.
   */
  private async evaluateAutoApprove(
    applicationId: string,
    userId: string,
  ): Promise<ApplicationStatus> {
    try {
      // ── Condition 1: required documents present ───────────────────────────
      const docs = await this.documentRepo.find({ where: { user_id: userId } });
      const uploadedTypes = new Set(docs.map((d) => d.document_type));
      const docsOk = REQUIRED_DOC_TYPES.every((type) => uploadedTypes.has(type));
      if (!docsOk) return ApplicationStatus.SIGNED;

      // ── Condition 2: AI valuation with sufficient confidence ──────────────
      const app = await this.appRepo.findOne({ where: { id: applicationId } });
      if (!app?.guarantee_id) return ApplicationStatus.SIGNED;

      const guarantee = await this.guaranteeRepo.findOne({ where: { id: app.guarantee_id } });
      if (!guarantee?.ai_confidence) return ApplicationStatus.SIGNED;
      if (Number(guarantee.ai_confidence) < AUTO_APPROVE_CONFIDENCE_THRESHOLD) {
        return ApplicationStatus.SIGNED;
      }

      return ApplicationStatus.APPROVED;
    } catch {
      return ApplicationStatus.SIGNED; // safe fallback: never block the user
    }
  }

  async findByApplication(applicationId: string): Promise<Signature> {
    const sig = await this.repo.findOne({ where: { application_id: applicationId } });
    if (!sig) throw new NotFoundException('Signature not found');
    return sig;
  }
}
