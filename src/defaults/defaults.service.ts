import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  LoanApplication,
  ApplicationStatus,
} from '../applications/entities/loan-application.entity';
import { Payment } from '../payments/entities/payment.entity';

/**
 * A loan is declared in default when a payment has been due for more than
 * DEFAULT_GRACE_DAYS without being settled.
 *
 * Payment schedule: monthly instalments starting one month after disbursed_at.
 * Instalment N is due at: disbursed_at + N months.
 * If today > due_date + DEFAULT_GRACE_DAYS, and instalment N is unpaid → default.
 */
const DEFAULT_GRACE_DAYS = 45;

@Injectable()
export class DefaultsService {
  private readonly logger = new Logger(DefaultsService.name);

  constructor(
    @InjectRepository(LoanApplication)
    private readonly appRepo: Repository<LoanApplication>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
  ) {}

  /** Runs every day at 02:00 (server local time). */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async checkDefaults(): Promise<void> {
    this.logger.log('Running daily default check…');
    const affected = await this.processDefaults();
    this.logger.log(`Default check complete — ${affected} loan(s) declared in default.`);
  }

  /**
   * Exposed for manual invocation from tests or admin endpoints.
   * Returns the number of loans newly declared in default.
   */
  async processDefaults(): Promise<number> {
    const disbursed = await this.appRepo.find({
      where: { status: ApplicationStatus.DISBURSED },
    });

    let count = 0;
    const now = new Date();

    for (const app of disbursed) {
      try {
        // Use disbursed_at; fall back to created_at for loans pre-dating this field.
        const baseDate = app.disbursed_at
          ? new Date(app.disbursed_at)
          : new Date(app.created_at);

        const paidCount = await this.paymentRepo.count({
          where: { application_id: app.id },
        });

        // The next instalment that must be paid is paidCount + 1.
        // It was due at: baseDate + (paidCount + 1) months.
        const dueDate = new Date(baseDate);
        dueDate.setMonth(dueDate.getMonth() + paidCount + 1);

        const deadlineMs = dueDate.getTime() + DEFAULT_GRACE_DAYS * 24 * 3600 * 1000;

        if (now.getTime() > deadlineMs) {
          // All instalments paid → no default needed.
          if (paidCount >= app.term_months) continue;

          await this.appRepo.manager.transaction(async (em) => {
            await em.update(LoanApplication, { id: app.id }, {
              status: ApplicationStatus.DEFAULTED,
            });
            if (app.guarantee_id) {
              // Import GuaranteeStatus inline to avoid circular deps.
              await em.query(
                `UPDATE guarantees SET status = 'seized' WHERE id = $1`,
                [app.guarantee_id],
              );
            }
          });

          this.logger.warn(
            `Loan ${app.id} declared in default — due ${dueDate.toISOString()}, now ${now.toISOString()}`,
          );
          count++;
        }
      } catch (err) {
        this.logger.error(`Error processing default for loan ${app.id}: ${err}`);
      }
    }

    return count;
  }
}
