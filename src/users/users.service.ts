import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Session } from './entities/session.entity';

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
