import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { User } from '../users/entities/user.entity';
import {
  LoanApplication,
  ApplicationStatus,
} from '../applications/entities/loan-application.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class MonthlySummaryService {
  private readonly logger = new Logger(MonthlySummaryService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(LoanApplication)
    private readonly appRepo: Repository<LoanApplication>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly mailService: MailService,
  ) {}

  /** Runs at 08:00 on the 1st of every month (Lima time). */
  @Cron('0 8 1 * *', { timeZone: 'America/Lima' })
  async sendMonthlySummaries(): Promise<void> {
    this.logger.log('Starting monthly summary dispatch…');
    const count = await this.processSummaries();
    this.logger.log(`Monthly summary complete — ${count} email(s) sent.`);
  }

  /**
   * Exposed for manual invocation (e.g. admin trigger or tests).
   * Returns the number of emails sent.
   */
  async processSummaries(): Promise<number> {
    const now = new Date();
    // Range: 1st of previous month → 1st of current month (exclusive)
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthLabel = prevMonthStart.toLocaleString('es-PE', {
      month: 'long',
      year:  'numeric',
      timeZone: 'America/Lima',
    });

    const users = await this.userRepo.find({ where: { notification_email: true } });
    let sent = 0;

    for (const user of users) {
      try {
        const [activeLoans, pendingCount] = await Promise.all([
          this.appRepo.find({
            where: { user_id: user.id, status: ApplicationStatus.DISBURSED },
          }),
          this.appRepo.count({
            where: [
              { user_id: user.id, status: ApplicationStatus.SUBMITTED },
              { user_id: user.id, status: ApplicationStatus.SIGNED },
              { user_id: user.id, status: ApplicationStatus.APPROVED },
            ],
          }),
        ]);

        // Skip users with no relevant activity
        if (activeLoans.length === 0 && pendingCount === 0) continue;

        let totalPaidThisMonth = 0;
        const loanRows: {
          amount: number;
          term_months: number;
          paid_count: number;
          remaining: number;
          next_due_date: Date | null;
          paid_this_month: number;
          cuotas_this_month: number;
        }[] = [];

        for (const loan of activeLoans) {
          const [paidCount, monthPayments] = await Promise.all([
            this.paymentRepo.count({
              where: { application_id: loan.id, status: PaymentStatus.COMPLETED },
            }),
            this.paymentRepo.find({
              where: {
                application_id: loan.id,
                status: PaymentStatus.COMPLETED,
                created_at: Between(prevMonthStart, prevMonthEnd),
              },
            }),
          ]);

          const base = loan.disbursed_at
            ? new Date(loan.disbursed_at)
            : new Date(loan.created_at);

          const nextDue = new Date(base);
          nextDue.setMonth(nextDue.getMonth() + paidCount + 1);

          const paidThisMonth = monthPayments.reduce((s, p) => s + Number(p.amount), 0);
          totalPaidThisMonth += paidThisMonth;

          loanRows.push({
            amount:           Number(loan.amount),
            term_months:      loan.term_months,
            paid_count:       paidCount,
            remaining:        Math.max(0, loan.term_months - paidCount),
            next_due_date:    paidCount >= loan.term_months ? null : nextDue,
            paid_this_month:  paidThisMonth,
            cuotas_this_month: monthPayments.length,
          });
        }

        await this.mailService.sendMonthlySummary(user.email, user.full_name, {
          month:                 monthLabel,
          active_loans:          loanRows,
          total_paid_this_month: totalPaidThisMonth,
          pending_applications:  pendingCount,
        });

        sent++;
      } catch (err) {
        this.logger.error(`Error processing summary for ${user.email}: ${err}`);
      }
    }

    return sent;
  }
}
