import { getSessionForDate, PROGRAM, PROGRAM_TIME_ZONE, WEEK_DAYS } from './program';
import type { Exercise, Weekday } from './types';

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Civil date in America/Chicago, used as the app's 'today' for the 8-day cycle. */
export function getTodayDateKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PROGRAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeek(date: Date): Date {
  const dayIndex = date.getDay();
  const offset = dayIndex === 0 ? -6 : 1 - dayIndex;
  return addDays(date, offset);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function getWeekday(date: Date): Weekday {
  const dayIndex = date.getDay();
  return WEEK_DAYS[dayIndex === 0 ? 6 : dayIndex - 1];
}

export function getExercisesForDate(dateKey: string): Exercise[] {
  return PROGRAM[getSessionForDate(dateKey)];
}

export function formatDateLabel(dateKey: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(parseDateKey(dateKey));
}

export function formatShortDate(dateKey: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(parseDateKey(dateKey));
}

export function formatMonth(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(date);
}
