import { Controller, Get } from '@nestjs/common';
import { OllamaService } from './ollama.service';

@Controller('ollama')
export class OllamaController {
  constructor(private readonly ollamaService: OllamaService) {}

  @Get('models')
  async getModels(): Promise<string[]> {
    return this.ollamaService.getModels();
  }
}
