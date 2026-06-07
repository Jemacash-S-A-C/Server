import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

function isMock(): boolean {
  return (process.env.SMTP_USER ?? 'REEMPLAZAR').includes('REEMPLAZAR');
}

function transport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  });
}

function fmtDate(): string {
  return new Date().toLocaleString('es-PE', {
    timeZone:  'America/Lima',
    dateStyle: 'long',
    timeStyle: 'short',
  } as Intl.DateTimeFormatOptions);
}

export interface MonthlySummaryData {
  month: string;
  active_loans: {
    amount: number;
    term_months: number;
    paid_count: number;
    remaining: number;
    next_due_date: Date | null;
    paid_this_month: number;
    cuotas_this_month: number;
  }[];
  total_paid_this_month: number;
  pending_applications: number;
}

@Injectable()
export class MailService {
  // ── OTP (siempre se envía, independiente de notification_email) ──────────────

  async sendOtpCode(to: string, code: string): Promise<void> {
    if (isMock()) {
      console.log(`[2FA Email mock] → ${to}: Tu código es ${code}`);
      return;
    }
    await transport().sendMail({
      from:    `"Jemacash" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Tu código de verificación — Jemacash',
      html:    this.otpHtml(code),
    });
  }

  // ── Resumen mensual ───────────────────────────────────────────────────────────

  async sendMonthlySummary(
    to:   string,
    name: string,
    data: MonthlySummaryData,
  ): Promise<void> {
    if (isMock()) {
      console.log(`[Monthly summary mock] → ${to}: ${data.month} | préstamos: ${data.active_loans.length} | pagado: S/ ${data.total_paid_this_month}`);
      return;
    }
    try {
      await transport().sendMail({
        from:    `"Jemacash" <${process.env.SMTP_USER}>`,
        to,
        subject: `Tu resumen de ${data.month} — Jemacash`,
        html:    this.monthlySummaryHtml(name, data),
      });
    } catch (err) {
      console.error('[MailService] Error sending monthly summary:', err);
    }
  }

  // ── Alertas de seguridad (respetan notification_email del usuario) ────────────

  async sendPasswordChanged(to: string, name: string, notifEnabled: boolean): Promise<void> {
    await this.alert(to, notifEnabled, {
      subject: 'Tu contraseña fue actualizada — Jemacash',
      title:   'Contraseña actualizada',
      body:    `Hola <strong>${name}</strong>, tu contraseña fue cambiada el <strong>${fmtDate()}</strong>.
                Si no fuiste tú, contacta a soporte inmediatamente.`,
      icon:    '🔑',
    });
  }

  async sendTwoFaChanged(
    to:           string,
    name:         string,
    method:       string,
    activated:    boolean,
    notifEnabled: boolean,
  ): Promise<void> {
    const action = activated ? 'activada' : 'desactivada';
    await this.alert(to, notifEnabled, {
      subject: `Verificación en dos pasos ${action} — Jemacash`,
      title:   `2FA ${action}`,
      body:    `Hola <strong>${name}</strong>, la autenticación mediante
                <strong>${method}</strong> fue <strong>${action}</strong>
                el ${fmtDate()}. Si no fuiste tú, revisa la seguridad de tu cuenta.`,
      icon:    activated ? '🛡️' : '⚠️',
    });
  }

  // ── Helpers privados ──────────────────────────────────────────────────────────

  private async alert(
    to:      string,
    enabled: boolean,
    opts:    { subject: string; title: string; body: string; icon: string },
  ): Promise<void> {
    if (!enabled) return;
    if (isMock()) {
      console.log(`[Security alert mock] → ${to}: ${opts.subject}`);
      return;
    }
    try {
      await transport().sendMail({
        from:    `"Jemacash" <${process.env.SMTP_USER}>`,
        to,
        subject: opts.subject,
        html:    this.alertHtml(opts.title, opts.body, opts.icon),
      });
    } catch (err) {
      // La alerta de seguridad es no-crítica; no bloquea la operación principal
      console.error('[MailService] Error sending security alert:', err);
    }
  }

  private monthlySummaryHtml(name: string, data: MonthlySummaryData): string {
    const fmt = (n: number) =>
      new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n);
    const fmtDate = (d: Date) =>
      d.toLocaleDateString('es-PE', {
        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Lima',
      });

    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

    const loansHtml = data.active_loans.map((loan, i) => {
      const progress = Math.round((loan.paid_count / loan.term_months) * 100);
      const nextDueStr = loan.next_due_date
        ? fmtDate(loan.next_due_date)
        : 'Préstamo saldado';
      const paidBadge = loan.cuotas_this_month > 0
        ? `<span style="background:#d9f0da;color:#0f7d3f;border-radius:6px;padding:2px 8px;font-size:0.78rem;font-weight:700">
             ${loan.cuotas_this_month} cuota${loan.cuotas_this_month > 1 ? 's' : ''} pagada${loan.cuotas_this_month > 1 ? 's' : ''} este mes
           </span>`
        : '';

      return `
        <div style="background:#f8faf8;border-radius:10px;padding:18px;margin-bottom:12px;border:1.5px solid #e2e8ee">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <strong style="color:#1a221c;font-size:0.95rem">Préstamo #${i + 1} — ${fmt(loan.amount)}</strong>
            ${paidBadge}
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:0.85rem;color:#4a5a4e">
            <tr>
              <td style="padding:4px 0;width:50%">Plazo total</td>
              <td style="padding:4px 0;font-weight:600;color:#1a221c">${loan.term_months} meses</td>
            </tr>
            <tr>
              <td style="padding:4px 0">Cuotas pagadas</td>
              <td style="padding:4px 0;font-weight:600;color:#1a221c">${loan.paid_count} / ${loan.term_months}</td>
            </tr>
            <tr>
              <td style="padding:4px 0">Cuotas restantes</td>
              <td style="padding:4px 0;font-weight:600;color:#1a221c">${loan.remaining}</td>
            </tr>
            <tr>
              <td style="padding:4px 0">Próximo vencimiento</td>
              <td style="padding:4px 0;font-weight:600;color:${loan.next_due_date ? '#d97706' : '#0f7d3f'}">${nextDueStr}</td>
            </tr>
          </table>
          <!-- Progress bar -->
          <div style="margin-top:12px">
            <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:#9aa09c;margin-bottom:4px">
              <span>Progreso del préstamo</span><span>${progress}%</span>
            </div>
            <div style="background:#e2e8ee;border-radius:999px;height:6px;overflow:hidden">
              <div style="background:#0f7d3f;height:6px;width:${progress}%;border-radius:999px"></div>
            </div>
          </div>
        </div>`;
    }).join('');

    const paidSection = data.total_paid_this_month > 0 ? `
      <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:16px;margin-bottom:20px;display:flex;align-items:center;gap:12px">
        <span style="font-size:1.5rem">✅</span>
        <div>
          <strong style="color:#0f7d3f;font-size:0.95rem">Total pagado en ${capitalize(data.month)}</strong>
          <p style="margin:2px 0 0;color:#1a221c;font-size:1.2rem;font-weight:800">${fmt(data.total_paid_this_month)}</p>
        </div>
      </div>` : '';

    const pendingSection = data.pending_applications > 0 ? `
      <div style="background:#fef3c7;border:1.5px solid #fcd34d;border-radius:10px;padding:14px;margin-bottom:20px">
        <strong style="color:#d97706">📋 Solicitudes en proceso</strong>
        <p style="margin:4px 0 0;color:#78350f;font-size:0.88rem">
          Tienes <strong>${data.pending_applications}</strong> solicitud${data.pending_applications > 1 ? 'es' : ''} pendiente${data.pending_applications > 1 ? 's' : ''} de aprobación.
          Nos pondremos en contacto contigo pronto.
        </p>
      </div>` : '';

    const noActivitySection = data.active_loans.length === 0 && data.pending_applications === 0 ? `
      <p style="color:#7a857e;font-size:0.9rem">No tuviste actividad registrada este mes. ¿Necesitas un préstamo? Ingresa a tu cuenta y solicítalo en minutos.</p>` : '';

    return `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:24px;background:#fff">

        <!-- Header -->
        <div style="background:linear-gradient(135deg,#0f7d3f,#15803d);border-radius:14px;padding:28px 24px;text-align:center;margin-bottom:24px">
          <h1 style="color:#fff;margin:0;font-size:1.5rem;font-weight:800;letter-spacing:-0.03em">Jemacash</h1>
          <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:0.95rem">
            Resumen mensual · ${capitalize(data.month)}
          </p>
        </div>

        <!-- Greeting -->
        <p style="color:#1a221c;font-size:1rem;margin:0 0 20px;line-height:1.6">
          Hola <strong>${name}</strong>, aquí tienes un resumen de tu actividad en Jemacash durante <strong>${capitalize(data.month)}</strong>.
        </p>

        <!-- Paid this month -->
        ${paidSection}

        <!-- Active loans -->
        ${data.active_loans.length > 0 ? `<h2 style="color:#1a221c;font-size:0.95rem;font-weight:800;margin:0 0 12px">💳 Préstamos Activos</h2>${loansHtml}` : ''}

        <!-- Pending applications -->
        ${pendingSection}

        <!-- No activity -->
        ${noActivitySection}

        <!-- Footer -->
        <hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0" />
        <p style="color:#94a3b8;font-size:0.78rem;margin:0;line-height:1.5">
          Este resumen fue enviado porque tienes activadas las notificaciones por correo en tu cuenta Jemacash.
          Puedes desactivarlas en <strong>Configuración → Preferencias</strong>.
          <br/>Encriptado y tratado bajo la normativa SBS Perú y la Ley N° 29733.
        </p>
      </div>`;
  }

  private otpHtml(code: string): string {
    return `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
        <h2 style="color:#0f7d3f;margin:0 0 8px">Código de verificación</h2>
        <p style="color:#5c675e;margin:0 0 24px">
          Ingresa este código para activar la verificación en dos pasos en tu cuenta Jemacash.
        </p>
        <div style="background:#f0f9f2;border-radius:12px;padding:24px;text-align:center">
          <span style="font-size:2.5rem;font-weight:800;letter-spacing:0.3em;color:#0f7d3f">${code}</span>
        </div>
        <p style="color:#94a3b8;font-size:0.85rem;margin:16px 0 0">
          Válido por 10 minutos. Si no solicitaste este código, ignora este correo.
        </p>
      </div>
    `;
  }

  private alertHtml(title: string, body: string, icon: string): string {
    return `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
        <p style="font-size:2rem;margin:0 0 12px">${icon}</p>
        <h2 style="color:#0f7d3f;margin:0 0 8px">${title}</h2>
        <p style="color:#5c675e;margin:0 0 24px;line-height:1.6">${body}</p>
        <hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0" />
        <p style="color:#94a3b8;font-size:0.82rem;margin:0">
          Este es un mensaje automático de seguridad de Jemacash. No respondas a este correo.
        </p>
      </div>
    `;
  }
}
