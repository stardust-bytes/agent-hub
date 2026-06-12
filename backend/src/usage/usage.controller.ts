import { Controller, Get } from '@nestjs/common';
import { UsageService } from './usage.service';

@Controller('usage')
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get()
  async getTotal() {
    return this.usageService.getTotal();
  }

  @Get('sessions')
  async getPerSession() {
    return this.usageService.getPerSession();
  }
}
