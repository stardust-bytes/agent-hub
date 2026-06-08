import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { CreateProviderModelDto } from './dto/create-provider-model.dto';

@Injectable()
export class ProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.provider.findMany({ include: { models: true } });
  }

  create(dto: CreateProviderDto) {
    return this.prisma.provider.create({
      data: { name: dto.name, type: dto.type ?? 'ollama', baseUrl: dto.baseUrl, key: dto.key },
    });
  }

  update(id: number, dto: UpdateProviderDto) {
    return this.prisma.provider.update({ where: { id }, data: dto });
  }

  remove(id: number) {
    return this.prisma.provider.delete({ where: { id } });
  }

  addModel(providerId: number, dto: CreateProviderModelDto) {
    return this.prisma.providerModel.create({ data: { providerId, name: dto.name } });
  }

  removeModel(_providerId: number, modelId: number) {
    return this.prisma.providerModel.delete({ where: { id: modelId } });
  }

  async findAllModels() {
    const models = await this.prisma.providerModel.findMany({ include: { provider: true } });
    return models.map(m => ({
      id: m.id,
      name: m.name,
      providerId: m.providerId,
      providerName: m.provider.name,
    }));
  }

  findModelWithProvider(id: number) {
    return this.prisma.providerModel.findUnique({
      where: { id },
      include: { provider: true },
    });
  }
}
