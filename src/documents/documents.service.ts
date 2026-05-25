import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { CreateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private readonly repo: Repository<Document>,
  ) {}

  create(userId: string, dto: CreateDocumentDto): Promise<Document> {
    const doc = this.repo.create({ ...dto, user_id: userId });
    return this.repo.save(doc);
  }

  findAllByUser(userId: string): Promise<Document[]> {
    return this.repo.find({
      where: { user_id: userId },
      select: { id: true, user_id: true, application_id: true, document_type: true,
                original_name: true, file_size: true, mime_type: true, status: true,
                notes: true, created_at: true },
      order: { created_at: 'DESC' },
    });
  }

  findByApplication(userId: string, applicationId: string): Promise<Document[]> {
    return this.repo.find({
      where: { user_id: userId, application_id: applicationId },
      select: { id: true, user_id: true, application_id: true, document_type: true,
                original_name: true, file_size: true, mime_type: true, status: true,
                notes: true, created_at: true },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(userId: string, id: string): Promise<Document> {
    const doc = await this.repo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.user_id !== userId) throw new ForbiddenException();
    return doc;
  }

  async remove(userId: string, id: string): Promise<void> {
    const doc = await this.findOne(userId, id);
    await this.repo.remove(doc);
  }
}
