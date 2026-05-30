import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Guarantee } from './entities/guarantee.entity';
import { CreateGuaranteeDto } from './dto/create-guarantee.dto';
import { UpdateGuaranteeAiDto } from './dto/update-guarantee-ai.dto';

@Injectable()
export class GuaranteesService {
  constructor(
    @InjectRepository(Guarantee) private readonly repo: Repository<Guarantee>,
  ) {}

  findAll(userId: string): Promise<Guarantee[]> {
    return this.repo.find({ where: { user_id: userId }, order: { created_at: 'DESC' } });
  }

  async create(userId: string, dto: CreateGuaranteeDto): Promise<Guarantee> {
    const guarantee = this.repo.create({ ...dto, estimated_value: dto.estimated_value ?? 0, user_id: userId });
    return this.repo.save(guarantee);
  }

  async findOne(id: string, userId: string): Promise<Guarantee> {
    const g = await this.repo.findOne({ where: { id, user_id: userId } });
    if (!g) throw new NotFoundException('Guarantee not found');
    return g;
  }

  async updateAiFields(id: string, userId: string, dto: UpdateGuaranteeAiDto): Promise<Guarantee> {
    const g = await this.findOne(id, userId);
    Object.assign(g, dto);
    // Keep estimated_value in sync so every component that reads it shows a real number
    if (dto.ai_resale_value !== undefined && dto.ai_resale_value > 0) {
      g.estimated_value = dto.ai_resale_value;
    }
    return this.repo.save(g);
  }
}
