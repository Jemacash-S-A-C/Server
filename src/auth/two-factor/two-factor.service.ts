import {
  Injectable, NotFoundException, BadRequestException, UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import * as bcrypt from 'bcrypt';
import { User } from '../../users/entities/user.entity';
import { MailService } from '../../mail/mail.service';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

@Injectable()
export class TwoFactorService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly mail: MailService,
  ) {}

  // ── helpers ──────────────────────────────────────────────────────────────────

  private async getUser(userId: string): Promise<User> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getStatus(userId: string) {
    const { totp_enabled, sms_2fa_enabled, sms_2fa_phone } = await this.getUser(userId);
    return { totp_enabled, email_2fa_enabled: sms_2fa_enabled, email_2fa_address: sms_2fa_phone };
  }

  // ── TOTP ──────────────────────────────────────────────────────────────────────

  async generateTotpSetup(userId: string): Promise<{ qrDataUrl: string; secret: string }> {
    const user = await this.getUser(userId);

    const generated = speakeasy.generateSecret({
      name:   `Jemacash (${user.email})`,
      issuer: 'Jemacash',
      length: 20,
    });
    await this.users.update(userId, { totp_secret: generated.base32, totp_enabled: false });

    const qrDataUrl = await QRCode.toDataURL(generated.otpauth_url!);
    const formatted = generated.base32.replace(/(.{4})/g, '$1 ').trim();

    return { qrDataUrl, secret: formatted };
  }

  async verifyAndEnableTotp(userId: string, token: string): Promise<void> {
    const user = await this.getUser(userId);
    if (!user.totp_secret) throw new BadRequestException('Inicia el proceso de configuración primero.');

    const isValid = speakeasy.totp.verify({
      secret:   user.totp_secret,
      encoding: 'base32',
      token,
      window:   1,
    });
    if (!isValid) throw new UnauthorizedException('Código incorrecto. Intenta de nuevo.');

    await this.users.update(userId, { totp_enabled: true });

    this.mail.sendTwoFaChanged(
      user.email, user.full_name, 'app de autenticación', true, user.notification_email,
    ).catch(() => {});
  }

  async disableTotp(userId: string): Promise<void> {
    const user = await this.getUser(userId);
    await this.users.update(userId, { totp_secret: null, totp_enabled: false });

    this.mail.sendTwoFaChanged(
      user.email, user.full_name, 'app de autenticación', false, user.notification_email,
    ).catch(() => {});
  }

  // ── Email OTP ─────────────────────────────────────────────────────────────────

  async sendEmailOtp(userId: string, email: string): Promise<void> {
    await this.getUser(userId);

    const code    = Math.floor(100_000 + Math.random() * 900_000).toString();
    const hash    = await bcrypt.hash(code, 10);
    const expires = new Date(Date.now() + OTP_TTL_MS);

    // Reuse sms_* columns — same purpose, different delivery channel
    await this.users.update(userId, { sms_otp_hash: hash, sms_otp_expires_at: expires });

    // OTP siempre se envía (independiente de notification_email)
    await this.mail.sendOtpCode(email, code);
  }

  async verifyAndEnableEmail(userId: string, email: string, code: string): Promise<void> {
    const user = await this.getUser(userId);
    if (!user.sms_otp_hash || !user.sms_otp_expires_at) {
      throw new BadRequestException('No hay un código pendiente. Solicita uno nuevo.');
    }
    if (user.sms_otp_expires_at < new Date()) {
      throw new BadRequestException('El código ha expirado. Solicita uno nuevo.');
    }

    const match = await bcrypt.compare(code, user.sms_otp_hash);
    if (!match) throw new UnauthorizedException('Código incorrecto.');

    await this.users.update(userId, {
      sms_2fa_phone:      email,
      sms_2fa_enabled:    true,
      sms_otp_hash:       null,
      sms_otp_expires_at: null,
    });

    this.mail.sendTwoFaChanged(
      user.email, user.full_name, 'correo electrónico', true, user.notification_email,
    ).catch(() => {});
  }

  async disableEmail(userId: string): Promise<void> {
    const user = await this.getUser(userId);
    await this.users.update(userId, {
      sms_2fa_phone:      null,
      sms_2fa_enabled:    false,
      sms_otp_hash:       null,
      sms_otp_expires_at: null,
    });

    this.mail.sendTwoFaChanged(
      user.email, user.full_name, 'correo electrónico', false, user.notification_email,
    ).catch(() => {});
  }
}
