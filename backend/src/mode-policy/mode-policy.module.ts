import { Module } from '@nestjs/common';
import { ModePolicyService } from './mode-policy.service';

@Module({
  providers: [ModePolicyService],
  exports: [ModePolicyService],
})
export class ModePolicyModule {}
