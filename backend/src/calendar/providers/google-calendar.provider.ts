import { Injectable } from '@nestjs/common';
import { CalendarProvider, CalendarEvent, CreateEventOptions } from './calendar-provider.interface';
import { OAuthService } from '../../oauth/oauth.service';
import { google } from 'googleapis';

@Injectable()
export class GoogleCalendarProvider implements CalendarProvider {
  private calendar: any = null;
  private initialized = false;

  constructor(private readonly oauth: OAuthService) {}

  private async ensureInit() {
    if (this.initialized) return;
    const result = await this.oauth.getClient();
    if (result) {
      this.calendar = google.calendar({ version: 'v3', auth: result.client as any });
    }
    this.initialized = true;
  }

  async listEvents(since?: string, until?: string, _calendar?: string): Promise<CalendarEvent[]> {
    await this.ensureInit();
    if (!this.calendar) return [];
    const res = await this.calendar.events.list({
      calendarId: 'primary',
      timeMin: since || new Date().toISOString(),
      timeMax: until || new Date(Date.now() + 7 * 86400000).toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });
    return (res.data.items || []).map((item: any) => ({
      id: item.id,
      title: item.summary || '(no title)',
      startTime: item.start?.dateTime || item.start?.date || '',
      endTime: item.end?.dateTime || item.end?.date || '',
      description: item.description,
      location: item.location,
      attendees: item.attendees?.map((a: any) => a.email) || [],
      htmlLink: item.htmlLink,
    }));
  }

  async createEvent(options: CreateEventOptions): Promise<CalendarEvent> {
    await this.ensureInit();
    if (!this.calendar) throw new Error('Calendar not configured');
    const res = await this.calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: options.title,
        description: options.description,
        location: options.location,
        start: { dateTime: options.startTime, timeZone: 'Asia/Ho_Chi_Minh' },
        end: { dateTime: options.endTime, timeZone: 'Asia/Ho_Chi_Minh' },
        attendees: options.attendees?.map(email => ({ email })) || [],
      },
    });
    return {
      id: res.data.id,
      title: res.data.summary || options.title,
      startTime: options.startTime,
      endTime: options.endTime,
      description: options.description,
      location: options.location,
      attendees: options.attendees,
      htmlLink: res.data.htmlLink,
    };
  }

  async updateEvent(id: string, updates: Partial<CreateEventOptions>): Promise<CalendarEvent> {
    await this.ensureInit();
    if (!this.calendar) throw new Error('Calendar not configured');
    const existing = await this.calendar.events.get({ calendarId: 'primary', eventId: id });
    const body: any = {};
    if (updates.title) body.summary = updates.title;
    if (updates.description !== undefined) body.description = updates.description;
    if (updates.location !== undefined) body.location = updates.location;
    if (updates.startTime) body.start = { dateTime: updates.startTime, timeZone: 'Asia/Ho_Chi_Minh' };
    if (updates.endTime) body.end = { dateTime: updates.endTime, timeZone: 'Asia/Ho_Chi_Minh' };
    if (updates.attendees) body.attendees = updates.attendees.map((email: string) => ({ email }));
    const res = await this.calendar.events.update({ calendarId: 'primary', eventId: id, requestBody: { ...existing.data, ...body } });
    return {
      id: res.data.id,
      title: res.data.summary || '',
      startTime: res.data.start?.dateTime || '',
      endTime: res.data.end?.dateTime || '',
      description: res.data.description,
      location: res.data.location,
      attendees: res.data.attendees?.map((a: any) => a.email) || [],
      htmlLink: res.data.htmlLink,
    };
  }

  async deleteEvent(id: string): Promise<void> {
    await this.ensureInit();
    if (!this.calendar) throw new Error('Calendar not configured');
    await this.calendar.events.delete({ calendarId: 'primary', eventId: id });
  }

  async checkAvailability(startTime: string, endTime: string, attendees?: string[]): Promise<{ available: boolean; conflicts?: CalendarEvent[] }> {
    const events = await this.listEvents(startTime, endTime);
    if (events.length === 0) return { available: true };
    return { available: false, conflicts: events };
  }
}
