import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { GoogleOAuthService } from './google-oauth.service';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  attendees?: string[];
}

@Injectable()
export class GoogleCalendarService {
  constructor(private readonly googleOAuth: GoogleOAuthService) {}

  private async getCalendar() {
    const auth = await this.googleOAuth.getAuthenticatedClient({ clientId: '', clientSecret: '', redirectUri: '' });
    if (!auth) throw new Error('Google not connected');
    return google.calendar({ version: 'v3', auth: auth as any });
  }

  async listEvents(since?: string, until?: string): Promise<CalendarEvent[]> {
    const calendar = await this.getCalendar();
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: since ?? new Date().toISOString(),
      timeMax: until,
      singleEvents: true,
      orderBy: 'startTime',
    });
    return (res.data.items ?? []).map(e => ({
      id: e.id!,
      summary: e.summary ?? '',
      description: e.description ?? undefined,
      startTime: e.start?.dateTime ?? e.start?.date ?? '',
      endTime: e.end?.dateTime ?? e.end?.date ?? '',
      location: e.location ?? undefined,
      attendees: e.attendees?.map(a => a.email!),
    }));
  }

  async createEvent(options: { title: string; startTime: string; endTime: string; description?: string; attendees?: string[]; location?: string }): Promise<CalendarEvent> {
    const calendar = await this.getCalendar();
    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: options.title,
        description: options.description,
        start: { dateTime: options.startTime },
        end: { dateTime: options.endTime },
        location: options.location,
        attendees: options.attendees?.map(email => ({ email })),
      },
    });
    return {
      id: res.data.id!,
      summary: res.data.summary ?? '',
      description: res.data.description ?? undefined,
      startTime: res.data.start?.dateTime ?? '',
      endTime: res.data.end?.dateTime ?? '',
      location: res.data.location ?? undefined,
      attendees: res.data.attendees?.map(a => a.email!),
    };
  }

  async updateEvent(id: string, updates: { title?: string; startTime?: string; endTime?: string; description?: string }): Promise<CalendarEvent> {
    const calendar = await this.getCalendar();
    const body: Record<string, unknown> = {};
    if (updates.title) body.summary = updates.title;
    if (updates.description !== undefined) body.description = updates.description;
    if (updates.startTime) body.start = { dateTime: updates.startTime };
    if (updates.endTime) body.end = { dateTime: updates.endTime };
    const res = await calendar.events.patch({ calendarId: 'primary', eventId: id, requestBody: body });
    return {
      id: res.data.id!,
      summary: res.data.summary ?? '',
      startTime: res.data.start?.dateTime ?? '',
      endTime: res.data.end?.dateTime ?? '',
    };
  }

  async checkAvailability(startTime: string, endTime: string): Promise<{ available: boolean; busySlots: { start: string; end: string }[] }> {
    const calendar = await this.getCalendar();
    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin: startTime,
        timeMax: endTime,
        items: [{ id: 'primary' }],
      },
    });
    const busy = res.data.calendars?.['primary']?.busy ?? [];
    return { available: busy.length === 0, busySlots: busy.map(b => ({ start: b.start!, end: b.end! })) };
  }
}
