import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailListExecutor } from './executors/email-list.executor';
import { EmailReadExecutor } from './executors/email-read.executor';
import { EmailSendExecutor } from './executors/email-send.executor';
import { EmailSearchExecutor } from './executors/email-search.executor';
import { EmailReplyExecutor } from './executors/email-reply.executor';
import { OAuthModule } from '../oauth/oauth.module';

@Module({
  imports: [OAuthModule],
  providers: [EmailService, EmailListExecutor, EmailReadExecutor, EmailSendExecutor, EmailSearchExecutor, EmailReplyExecutor],
  exports: [EmailService, EmailListExecutor, EmailReadExecutor, EmailSendExecutor, EmailSearchExecutor, EmailReplyExecutor],
})
export class EmailModule {}
