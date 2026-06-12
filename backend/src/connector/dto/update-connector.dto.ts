import { PartialType } from '@nestjs/mapped-types';
import { UpsertConnectorDto } from './upsert-connector.dto';

export class UpdateConnectorDto extends PartialType(UpsertConnectorDto) {}
