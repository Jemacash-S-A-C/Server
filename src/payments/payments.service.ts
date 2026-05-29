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

    let mpPaymentId: string | null = null;

    if (!isMpMockMode()) {
      const client = new MercadoPagoConfig({
        accessToken: process.env.MP_ACCESS_TOKEN!,
      });
      const paymentApi = new MpPayment(client);

      const result = await paymentApi.create({
        body: {
          token: dto.token,
          transaction_amount: dto.amount,
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
        throw new BadRequestException(
          result.status_detail ?? 'El pago fue rechazado por Mercado Pago.',
        );
      }

      mpPaymentId = String(result.id);
    }

    const payment = this.repo.create({
      application_id: dto.application_id,
      user_id: userId,
      amount: dto.amount,
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
