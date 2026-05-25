import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';

function generateReference(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `JM-${ts}-${rand}`;
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly repo: Repository<Payment>,
  ) {}

  async create(userId: string, dto: CreatePaymentDto): Promise<Payment> {
    const payment = this.repo.create({
      ...dto,
      user_id: userId,
      status: PaymentStatus.COMPLETED,
      reference_number: generateReference(),
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
