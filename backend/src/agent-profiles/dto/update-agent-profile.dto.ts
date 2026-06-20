import { PartialType } from '@nestjs/mapped-types';
import { CreateAgentProfileDto } from './create-agent-profile.dto';

export class UpdateAgentProfileDto extends PartialType(CreateAgentProfileDto) {}
