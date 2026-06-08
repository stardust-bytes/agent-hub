import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe } from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { CreateProviderModelDto } from './dto/create-provider-model.dto';

@Controller('providers')
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get('models')
  getAllModels() {
    return this.providersService.findAllModels();
  }

  @Get()
  findAll() {
    return this.providersService.findAll();
  }

  @Post()
  create(@Body() dto: CreateProviderDto) {
    return this.providersService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProviderDto) {
    return this.providersService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.providersService.remove(id);
  }

  @Post(':id/models')
  addModel(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateProviderModelDto) {
    return this.providersService.addModel(id, dto);
  }

  @Delete(':id/models/:modelId')
  async removeModel(
    @Param('id', ParseIntPipe) id: number,
    @Param('modelId', ParseIntPipe) modelId: number,
  ) {
    await this.providersService.removeModel(id, modelId);
  }
}
