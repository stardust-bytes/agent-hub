import { Module } from '@nestjs/common';
import { ConnectorService } from './connector.service';
import { ConnectorController } from './connector.controller';
import { GoogleOAuthService } from './providers/google/google-oauth.service';

@Module({
  controllers: [ConnectorController],
  providers: [ConnectorService, GoogleOAuthService],
  exports: [ConnectorService, GoogleOAuthService],
})
export class ConnectorModule {}
