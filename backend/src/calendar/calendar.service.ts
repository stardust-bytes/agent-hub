import { Injectable } from '@nestjs/common';
import { CalendarProvider, CalendarEvent, CreateEventOptions } from './providers/calendar-provider.interface';
import { GoogleCalendarProvider } from './providers/google-calendar.provider';
import { OAuthService } from '../oauth/oauth.service';

@Injectable()
export class CalendarService {
  private _provider: CalendarProvider | null = null;

  constructor(private readonly oauth: OAuthService) {}

  private async getProvider(): Promise<CalendarProvider> {
    if (this._provider) return this._provider;
    const oauthConfig = await this.oauth.getConfig();
    if (oauthConfig?.tokens?.access_token) {
      this._provider = new GoogleCalendarProvider(this.oauth);
    } else {
      throw new Error('Calendar not configured. Please set up Google OAuth in Settings.');
    }
    return this._provider;
  }

  async listEvents(since?: string, until?: string): Promise<CalendarEvent[]> {
    return (await this.getProvider()).listEvents(since, until);
  }

  async createEvent(options: CreateEventOptions): Promise<CalendarEvent> {
    return (await this.getProvider()).createEvent(options);
  }

  async updateEvent(id: string, updates: Partial<CreateEventOptions>): Promise<CalendarEvent> {
    return (await this.getProvider()).updateEvent(id, updates);
  }

  async deleteEvent(id: string): Promise<void> {
    return (await this.getProvider()).deleteEvent(id);
  }

  async checkAvailability(startTime: string, endTime: string): Promise<{ available: boolean; conflicts?: CalendarEvent[] }> {
    return (await this.getProvider()).checkAvailability(startTime, endTime);
  }
}
