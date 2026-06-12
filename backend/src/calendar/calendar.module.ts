import { Module } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CalendarListEventsExecutor } from './executors/calendar-list-events.executor';
import { CalendarCreateEventExecutor } from './executors/calendar-create-event.executor';
import { CalendarUpdateEventExecutor } from './executors/calendar-update-event.executor';
import { CalendarCheckAvailabilityExecutor } from './executors/calendar-check-availability.executor';
import { OAuthModule } from '../oauth/oauth.module';

@Module({
  imports: [OAuthModule],
  providers: [CalendarService, CalendarListEventsExecutor, CalendarCreateEventExecutor, CalendarUpdateEventExecutor, CalendarCheckAvailabilityExecutor],
  exports: [CalendarService, CalendarListEventsExecutor, CalendarCreateEventExecutor, CalendarUpdateEventExecutor, CalendarCheckAvailabilityExecutor],
})
export class CalendarModule {}
