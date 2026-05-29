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
