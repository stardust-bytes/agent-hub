export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  description?: string;
  location?: string;
  attendees?: string[];
  htmlLink?: string;
}

export interface CreateEventOptions {
  title: string;
  startTime: string;
  endTime: string;
  description?: string;
  attendees?: string[];
  location?: string;
}

export interface CalendarProvider {
  listEvents(since?: string, until?: string, calendar?: string): Promise<CalendarEvent[]>;
  createEvent(options: CreateEventOptions): Promise<CalendarEvent>;
  updateEvent(id: string, updates: Partial<CreateEventOptions>): Promise<CalendarEvent>;
  deleteEvent(id: string): Promise<void>;
  checkAvailability(startTime: string, endTime: string, attendees?: string[]): Promise<{ available: boolean; conflicts?: CalendarEvent[] }>;
}
