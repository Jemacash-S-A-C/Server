import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { Session } from './entities/session.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Session) private readonly sessionRepo: Repository<Session>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    if (Object.keys(dto).length > 0) {
      await this.userRepo.update(userId, dto);
    }
    return this.userRepo.findOneOrFail({ where: { id: userId } });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) throw new UnauthorizedException('Contraseña actual incorrecta.');
    const hash = await bcrypt.hash(newPassword, 12);
    await this.userRepo.update(userId, { password_hash: hash });
  }

  async createSession(userId: string, expiresAt: Date): Promise<Session> {
    const session = this.sessionRepo.create({ user_id: userId, expires_at: expiresAt });
    return this.sessionRepo.save(session);
  }

  async findSession(sessionId: string): Promise<Session | null> {
    return this.sessionRepo.findOne({ where: { id: sessionId } });
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.sessionRepo.delete({ id: sessionId });
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await this.sessionRepo.delete({ user_id: userId });
  }
}
