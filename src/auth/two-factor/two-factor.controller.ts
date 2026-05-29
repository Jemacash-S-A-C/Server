import {
  Controller, Get, Post, Delete, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { TwoFactorService } from './two-factor.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';
import { IsEmail, IsString, Length, Matches } from 'class-validator';

class VerifyTotpDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'El token debe ser exactamente 6 dígitos.' })
  token: string;
}

class SendEmailOtpDto {
  @IsEmail({}, { message: 'Correo electrónico inválido.' })
  email: string;
}

class VerifyEmailOtpDto {
  @IsEmail({}, { message: 'Correo electrónico inválido.' })
  email: string;

  @IsString()
  @Length(6, 6, { message: 'El código debe tener exactamente 6 dígitos.' })
  code: string;
}

@UseGuards(JwtAuthGuard)
@Controller('auth/2fa')
export class TwoFactorController {
  constructor(private readonly svc: TwoFactorService) {}

  @Get('status')
  getStatus(@CurrentUser() user: User) {
    return this.svc.getStatus(user.id);
  }

  // ── TOTP ─────────────────────────────────────────────────────────────────────

  @Post('totp/setup')
  totpSetup(@CurrentUser() user: User) {
    return this.svc.generateTotpSetup(user.id);
  }

  @Post('totp/verify')
  @HttpCode(HttpStatus.NO_CONTENT)
  totpVerify(@CurrentUser() user: User, @Body() dto: VerifyTotpDto) {
    return this.svc.verifyAndEnableTotp(user.id, dto.token);
  }

  @Delete('totp')
  @HttpCode(HttpStatus.NO_CONTENT)
  totpDisable(@CurrentUser() user: User) {
    return this.svc.disableTotp(user.id);
  }

  // ── Email OTP ─────────────────────────────────────────────────────────────────

  @Post('email/send')
  @HttpCode(HttpStatus.NO_CONTENT)
  emailSend(@CurrentUser() user: User, @Body() dto: SendEmailOtpDto) {
    return this.svc.sendEmailOtp(user.id, dto.email);
  }

  @Post('email/verify')
  @HttpCode(HttpStatus.NO_CONTENT)
  emailVerify(@CurrentUser() user: User, @Body() dto: VerifyEmailOtpDto) {
    return this.svc.verifyAndEnableEmail(user.id, dto.email, dto.code);
  }

  @Delete('email')
  @HttpCode(HttpStatus.NO_CONTENT)
  emailDisable(@CurrentUser() user: User) {
    return this.svc.disableEmail(user.id);
  }
}
