import { Module } from '@nestjs/common';
import { ConnectorService } from './connector.service';
import { ConnectorController } from './connector.controller';
import { GoogleOAuthService } from './providers/google/google-oauth.service';
import { GmailService } from './providers/google/gmail.service';
import { GoogleCalendarService } from './providers/google/google-calendar.service';
import { GoogleDriveService } from './providers/google/google-drive.service';
import { GoogleSheetsService } from './providers/google/google-sheets.service';

@Module({
  controllers: [ConnectorController],
  providers: [ConnectorService, GoogleOAuthService, GmailService, GoogleCalendarService, GoogleDriveService, GoogleSheetsService],
  exports: [ConnectorService, GoogleOAuthService, GmailService, GoogleCalendarService, GoogleDriveService, GoogleSheetsService],
})
export class ConnectorModule {}
