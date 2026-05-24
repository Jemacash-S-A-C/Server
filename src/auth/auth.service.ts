import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/entities/user.entity';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email.toLowerCase());
    if (existing) throw new ConflictException('Email already registered');

    const password_hash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({
      full_name: dto.full_name.trim(),
      email: dto.email.toLowerCase(),
      password_hash,
      phone: dto.phone?.trim(),
    });

    return this.issueTokens(user);
  }

  async login(dto: LoginDto) {
    const identifier = dto.identifier.trim().toLowerCase();
    const user = await this.usersService.findByEmail(identifier);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; jti: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'changeme-refresh',
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.usersService.findSession(payload.jti);
    if (!session || session.expires_at < new Date()) {
      throw new UnauthorizedException('Session expired or not found');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException();

    await this.usersService.deleteSession(session.id);
    return this.issueTokens(user);
  }

  async logout(refreshToken: string) {
    try {
      const payload: { jti: string } = this.jwtService.decode(refreshToken) as any;
      if (payload?.jti) await this.usersService.deleteSession(payload.jti);
    } catch {
      // best-effort logout
    }
  }

  private async issueTokens(user: User) {
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
    const session = await this.usersService.createSession(user.id, expiresAt);

    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email },
      { expiresIn: ACCESS_TOKEN_EXPIRY },
    );

    const refreshToken = this.jwtService.sign(
      { sub: user.id, jti: session.id },
      {
        secret: process.env.JWT_REFRESH_SECRET ?? 'changeme-refresh',
        expiresIn: '30d',
      },
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: this.toProfile(user),
    };
  }

  toProfile(user: User) {
    return {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      initials: user.full_name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join(''),
      created_at: user.created_at,
    };
  }
}
