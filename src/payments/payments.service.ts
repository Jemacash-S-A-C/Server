import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MercadoPagoConfig, Payment as MpPayment } from 'mercadopago';
import { Payment, PaymentMethod, PaymentStatus } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { MpChargeDto } from './dto/mp-charge.dto';

function generateReference(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `JM-${ts}-${rand}`;
}

function isMpMockMode(): boolean {
  const token = process.env.MP_ACCESS_TOKEN ?? '';
  return !token || token.includes('REEMPLAZAR');
}

// Human-readable messages for MP status_detail codes
const MP_REJECTION_MESSAGES: Record<string, string> = {
  cc_rejected_other_reason:           'La tarjeta fue rechazada. Intenta con otra tarjeta.',
  cc_rejected_insufficient_amount:    'Fondos insuficientes en la tarjeta.',
  cc_rejected_bad_filled_security_code: 'Código de seguridad incorrecto.',
  cc_rejected_bad_filled_date:        'Fecha de vencimiento incorrecta.',
  cc_rejected_bad_filled_other:       'Datos de la tarjeta incorrectos.',
  cc_rejected_card_disabled:          'La tarjeta está deshabilitada.',
  cc_rejected_call_for_authorize:     'El banco requiere autorización. Llama a tu banco.',
  cc_rejected_duplicated_payment:     'Pago duplicado detectado.',
  cc_rejected_high_risk:              'Pago rechazado por evaluación de riesgo.',
  cc_amount_rate_limit_exceeded:      'Límite de monto excedido en la tarjeta.',
  pending_contingency:                'El pago está en proceso, espera unos minutos.',
  pending_review_manual:              'El pago está en revisión.',
};

function translateMpRejection(statusDetail?: string | null): string {
  if (!statusDetail) return 'El pago fue rechazado. Inténtalo de nuevo.';
  return MP_REJECTION_MESSAGES[statusDetail] ?? 'El pago fue rechazado. Inténtalo de nuevo.';
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly repo: Repository<Payment>,
  ) {}

  async mpCharge(userId: string, dto: MpChargeDto): Promise<Payment> {
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

    // MP rejects transaction_amount with more than 2 decimal places
    const transactionAmount = parseFloat(Number(dto.amount).toFixed(2));
    let mpPaymentId: string | null = null;

    if (!isMpMockMode()) {
      const client = new MercadoPagoConfig({
        accessToken: process.env.MP_ACCESS_TOKEN!,
      });
      const paymentApi = new MpPayment(client);

      try {
        const result = await paymentApi.create({
          body: {
            token: dto.token,
            transaction_amount: transactionAmount,
            currency_id: 'PEN',
            installments: dto.installments,
            payment_method_id: dto.payment_method_id,
            issuer_id: dto.issuer_id ? parseInt(dto.issuer_id, 10) : undefined,
            payer: { email: dto.email },
            description: `Cuota ${dto.cuota_number} — Jemacash`,
          },
          requestOptions: {
            idempotencyKey: `jemacash-${dto.application_id}-cuota-${dto.cuota_number}`,
          },
        });

        if (result.status !== 'approved') {
          throw new BadRequestException(translateMpRejection(result.status_detail));
        }

        mpPaymentId = String(result.id);
      } catch (err) {
        // Re-throw our own controlled exceptions as-is
        if (err instanceof BadRequestException) throw err;
        // MP SDK throws a raw object on 4xx/5xx — surface a clean message
        throw new BadRequestException(
          'No se pudo procesar el pago con Mercado Pago. Inténtalo de nuevo.',
        );
      }
    }

    const payment = this.repo.create({
      application_id: dto.application_id,
      user_id: userId,
      amount: transactionAmount,
      payment_method: PaymentMethod.MERCADOPAGO,
      status: PaymentStatus.COMPLETED,
      cuota_number: dto.cuota_number,
      reference_number: generateReference(),
      mp_payment_id: mpPaymentId,
    });
    return this.repo.save(payment);
  }

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
