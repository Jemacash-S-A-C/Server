import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { Payment, PaymentMethod, PaymentStatus } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { MpPreferenceDto } from './dto/mp-preference.dto';
import { MpConfirmDto } from './dto/mp-confirm.dto';

function generateReference(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `JM-${ts}-${rand}`;
}

function isMpMockMode(): boolean {
  const token = process.env.MP_ACCESS_TOKEN ?? '';
  return !token || token.includes('REEMPLAZAR');
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly repo: Repository<Payment>,
  ) {}

  // ── Checkout Pro: create MP preference → returns redirect URL ────────────────

  async mpPreference(
    userId: string,
    dto: MpPreferenceDto,
  ): Promise<{ checkoutUrl: string; isMock: boolean }> {
    const existing = await this.repo.findOne({
      where: { application_id: dto.application_id, cuota_number: dto.cuota_number },
    });
    if (existing) {
      throw new ConflictException(`La cuota ${dto.cuota_number} ya fue pagada.`);
    }

    if (isMpMockMode()) {
      return { checkoutUrl: '', isMock: true };
    }

    const amount = parseFloat(Number(dto.amount).toFixed(2));
    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });
    const preferenceApi = new Preference(client);

    const frontendUrl = (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/$/, '');

    const result = await preferenceApi.create({
      body: {
        items: [
          {
            id: `${dto.application_id}-${dto.cuota_number}`,
            title: `Cuota ${dto.cuota_number} — Jemacash`,
            quantity: 1,
            unit_price: amount,
            currency_id: 'PEN',
          },
        ],
        payer: { email: dto.email },
        back_urls: {
          success: `${frontendUrl}/?mp_status=success`,
          failure: `${frontendUrl}/?mp_status=failure`,
          pending: `${frontendUrl}/?mp_status=pending`,
        },
        external_reference: `${dto.application_id}|${dto.cuota_number}`,
      },
    });

    const isSandbox = process.env.MP_ACCESS_TOKEN!.startsWith('TEST-');
    const checkoutUrl = isSandbox
      ? result.sandbox_init_point!
      : result.init_point!;

    return { checkoutUrl, isMock: false };
  }

  // ── Checkout Pro: confirm payment after MP redirect ──────────────────────────

  async mpConfirm(userId: string, dto: MpConfirmDto): Promise<Payment> {
    const existing = await this.repo.findOne({
      where: { application_id: dto.application_id, cuota_number: dto.cuota_number },
    });
    if (existing) {
      // Already saved (e.g. double redirect) — return idempotently
      return existing;
    }

    if (dto.cuota_number > 1) {
      const previousPaid = await this.repo.count({
        where: { application_id: dto.application_id, user_id: userId },
      });
      if (previousPaid < dto.cuota_number - 1) {
        throw new BadRequestException(
          `Debes pagar la cuota ${previousPaid + 1} antes de pagar la cuota ${dto.cuota_number}.`,
        );
      }
    }

    const amount = parseFloat(Number(dto.amount).toFixed(2));
    const payment = this.repo.create({
      application_id: dto.application_id,
      user_id: userId,
      amount,
      payment_method: PaymentMethod.MERCADOPAGO,
      status: PaymentStatus.COMPLETED,
      cuota_number: dto.cuota_number,
      reference_number: generateReference(),
      mp_payment_id: dto.mp_payment_id,
    });
    return this.repo.save(payment);
  }

  // ── Manual payment (BCP, BBVA, Yape, etc.) ──────────────────────────────────

  async create(userId: string, dto: CreatePaymentDto): Promise<Payment> {
    const existing = await this.repo.findOne({
      where: { application_id: dto.application_id, cuota_number: dto.cuota_number },
    });
    if (existing) {
      throw new ConflictException(`La cuota ${dto.cuota_number} ya fue pagada.`);
    }

    if (dto.cuota_number > 1) {
      const previousPaid = await this.repo.count({
        where: { application_id: dto.application_id, user_id: userId },
      });
      if (previousPaid < dto.cuota_number - 1) {
        throw new BadRequestException(
          `Debes pagar la cuota ${previousPaid + 1} antes de pagar la cuota ${dto.cuota_number}.`,
        );
      }
    }

    const payment = this.repo.create({
      ...dto,
      user_id: userId,
      status: PaymentStatus.COMPLETED,
      reference_number: generateReference(),
      mp_payment_id: null,
    });
    return this.repo.save(payment);
  }

  findByApplication(applicationId: string, userId: string): Promise<Payment[]> {
    return this.repo.find({
      where: { application_id: applicationId, user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  findAll(userId: string): Promise<Payment[]> {
    return this.repo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Payment> {
    const p = await this.repo.findOne({ where: { id, user_id: userId } });
    if (!p) throw new NotFoundException('Payment not found');
    return p;
  }
}
